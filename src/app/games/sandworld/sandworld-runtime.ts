import { Ticker } from 'pixi.js';
import { PixiStage } from './rendering/pixi-stage';
import { TerrainLayer } from './rendering/terrain/terrain-layer';
import { Camera, Rect } from './rendering/camera';
import { BrushArea, CellCursor } from './rendering/cell-cursor';
import { GrainParticles } from './rendering/sands/grain-particles';
import { DevTileOverlay, DevTileView } from './rendering/dev/dev-tile-overlay';
import { Precipitation } from './rendering/weather/precipitation';
import { Lightning } from './rendering/weather/lightning';
import { SeasonBlend } from './rendering/daylight-layer';
import { WeatherState } from './domain/models/weather.model';
import { DaylightLayer } from './rendering/daylight-layer';
import { CloudLayer } from './rendering/clouds/cloud-layer';
import { RevealEffect } from './rendering/clouds/reveal-effect';
import { isoToWorld } from './rendering/iso';
import { PointerInput } from './infrastructure/input/pointer-input';
import { TimeEngine } from './application/time/time-engine';
import { World } from './application/world/world';
import { WORLD } from './domain/models/world.model';
import { BRUSH_CELLS } from './config/brush.config';
import { CLOUD_CAMERA_MARGIN, REVEAL_ON_START } from './config/clouds.config';
import { REBAKE_INTERVAL_MS } from './config/physics.config';
import { POUR_EDGE_BAND, POUR_TAP_SECONDS } from './config/pour.config';
import { ChunkCoord } from './domain/events/game-events';
import { FaunaLayer, FaunaView, Ground } from './rendering/fauna/fauna-layer';

/** Avisos del runtime hacia fuera (el componente los conecta con el servicio) */
export interface RuntimeHooks {
  /** Cada frame, con el tiempo real actual en ms */
  frame?(nowMs: number): void;
  /** Toque sobre la isla sin arena seleccionada: tile tocado y punto de pantalla */
  tileTap?(tile: TappedTile): void;
  /** Tiempo y estación del momento (para la luz, el tono y la lluvia) */
  atmosphere?(): { readonly weather: WeatherState; readonly season: SeasonBlend };
  /** Pincel de arena (lo implementa el servicio) */
  pour?: PourHooks;
  /** Animales que dibujar (solo lectura) */
  fauna?(): FaunaView;
  /** Toque sobre un animal */
  animalTap?(id: number): void;
}

/** Tile que se ha tocado (chunk + tile) y dónde está en pantalla */
export interface TappedTile {
  readonly cx: number;
  readonly cy: number;
  readonly i: number;
  readonly j: number;
  /** Celda tocada dentro del chunk (para saber si es agua) */
  readonly ci: number;
  readonly cj: number;
  readonly screenX: number;
  readonly screenY: number;
  /** Planta tocada (id del registro), si el dedo cayó sobre una */
  readonly plant: number | null;
}

/** Lo que el runtime necesita del servicio para verter: el runtime sabe dónde está el dedo; el servicio, qué cae */
export interface PourHooks {
  /** El dedo se apoya con una arena elegida */
  begin(): void;
  /** El dedo pasa `seconds` sobre el bloque que empieza en la celda global (gx, gy). Devuelve si cayó arena. */
  at(gx: number, gy: number, seconds: number): boolean;
  /** El dedo se levanta (o entra un segundo dedo): lo vertido pasa a asentarse */
  end(): void;
  /** Color de los granos (el de la arena elegida) */
  color(): number;
}

const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;
/** Al tocar un animal: si está por debajo de esta parte de la pantalla (la tapará su ficha), se sube a ANIMAL_SCREEN_Y */
const ANIMAL_VISIBLE_UNTIL = 0.36;
const ANIMAL_SCREEN_Y = 0.26;
/** Cada cuántos ms se revisa el aspecto de estación de las plantas */
const PLANT_LOOK_MS = 500;

/**
 * Raíz de composición del juego en marcha: une motor de tiempo, render, cámara y entrada.
 * El componente Angular solo crea esto, lo monta y lo destruye.
 * Cada frame: avanza el tiempo → mueve la cámara → nubes y apariciones → luz del día.
 */
export class SandworldRuntime {
  private readonly stage = new PixiStage();
  private readonly camera = new Camera();
  private readonly cursor = new CellCursor();
  private readonly grains = new GrainParticles();
  private devOverlay: DevTileOverlay | null = null;
  private readonly precipitation = new Precipitation();
  private readonly lightning = new Lightning();
  private readonly fauna = new FaunaLayer();
  /** Punto de pantalla donde está el dedo que vierte, o null si no se está vertiendo */
  private brushPoint: { x: number; y: number } | null = null;
  private readonly terrains = new Map<string, TerrainLayer>();
  private readonly reveals: RevealEffect[] = [];
  /** Chunks con el terreno cambiado pendientes de re-hornear, y cuándo se hornearon por última vez */
  private readonly dirty = new Set<string>();
  private readonly lastBake = new Map<string, number>();
  private now = 0;
  private clouds: CloudLayer | null = null;
  private daylight: DaylightLayer | null = null;
  private input: PointerInput | null = null;
  private destroyed = false;
  /** true cuando hay una arena seleccionada. Sin arena, 1 dedo mueve la cámara. */
  private brushEnabled = false;
  /** Lo pidió el servicio antes de montar (el efecto de Angular puede llegar antes que Pixi) */
  private devViewWanted: DevTileView | null = null;
  private plantClock = 0;
  /** ¿Está descubierto el chunk? (para saber qué bordes son precipicio) */
  private readonly revealed = (cx: number, cy: number): boolean => this.world.exploration.isRevealed(cx, cy);

  constructor(
    private readonly engine: TimeEngine,
    private readonly world: World,
    private readonly hooks: RuntimeHooks = {},
  ) {}

  /** Devuelve false si se destruyó antes de terminar de cargar */
  async mount(host: HTMLElement): Promise<boolean> {
    const app = await this.stage.mount(host, (w, h) => {
      this.camera.setViewport(w, h);
      this.precipitation.resize(w, h);
      this.lightning.resize(w, h);
    });
    if (!app || this.destroyed) return false;

    // Mar de nubes detrás de todo; la isla flota encima
    this.clouds = new CloudLayer(this.world.seed);
    this.devOverlay = new DevTileOverlay(this.world);
    this.stage.world.addChild(this.clouds.back, this.cursor.view, this.grains.view, this.devOverlay.view);
    this.devOverlay.show(this.devViewWanted);
    // Lluvia y nieve por encima del mundo, en coordenadas de pantalla
    app.stage.addChild(this.precipitation.view);
    this.precipitation.resize(app.screen.width, app.screen.height);
    // Rayos: el rayo dentro del mundo (encima de todo) y el destello sobre toda la pantalla
    this.lightning.view.zIndex = 1e6;
    this.stage.world.addChild(this.lightning.view);
    app.stage.addChild(this.lightning.flash);
    this.lightning.resize(app.screen.width, app.screen.height);

    // Chunks ya descubiertos (en la fase 5 vendrán de la partida guardada)
    for (const { cx, cy } of this.world.exploration.list()) {
      this.addChunk(cx, cy, REVEAL_ON_START);
    }

    this.camera.setViewport(app.screen.width, app.screen.height);
    this.camera.setBounds(this.discoveredBounds(0));
    this.camera.fit();
    // Margen para asomarse a las nubes (después de encajar, para no alejar el zoom inicial)
    this.camera.setBounds(this.discoveredBounds(CLOUD_CAMERA_MARGIN));

    this.daylight = new DaylightLayer(color => (app.renderer.background.color = color), this.stage.world);

    this.input = new PointerInput(host, {
      brush: (phase, x, y) => {
        if (phase === 'start') {
          this.brushPoint = { x, y };
          this.hooks.pour?.begin();
          // Un toque corto también deja un pellizco de arena
          this.pourUnderFinger(POUR_TAP_SECONDS * 1000);
        } else if (phase === 'move') {
          this.brushPoint = { x, y };
        } else {
          // 'end' o 'cancel' (segundo dedo): lo vertido hasta ahora se queda y empieza a asentarse
          if (phase === 'end') this.pointAt(x, y);
          this.brushPoint = null;
          this.hooks.pour?.end();
          if (phase === 'cancel') this.cursor.hide();
        }
      },
      hover: (x, y) => this.pointAt(x, y),
      tap: (x, y) => {
        const G = WORLD.CELLS_PER_TILE;
        const w = this.camera.screenToWorld(x, y);
        // Primero, ¿hay un animal bajo el dedo? Después, ¿una planta? (su copa puede tapar celdas de detrás)
        const animal = this.fauna.animalAt(w.x, w.y);
        if (animal !== null) {
          this.hooks.animalTap?.(animal);
          // La ficha tapa la mitad de abajo: si el animal queda debajo, la cámara lo sube a la parte de arriba
          const vh = this.camera.viewportHeight;
          if (y > vh * ANIMAL_VISIBLE_UNTIL) this.camera.glideTo(w.x, w.y + (vh * (0.5 - ANIMAL_SCREEN_Y)) / this.camera.scale);
          return;
        }
        for (const layer of [...this.terrains.values()].sort((a, b) => b.view.zIndex - a.view.zIndex)) {
          const plant = layer.plantAt(w.x, w.y);
          const coords = layer.coords;
          if (!plant || !coords) continue;
          this.hooks.tileTap?.({
            cx: coords.cx, cy: coords.cy, i: Math.floor(plant.ci / G), j: Math.floor(plant.cj / G),
            ci: plant.ci, cj: plant.cj, screenX: x, screenY: y, plant: plant.plant,
          });
          return;
        }
        const area = this.areaAt(x, y);
        if (area) {
          this.hooks.tileTap?.({
            cx: area.cx, cy: area.cy, i: Math.floor(area.ci / G), j: Math.floor(area.cj / G),
            ci: area.ci, cj: area.cj, screenX: x, screenY: y, plant: null,
          });
        }
      },
      leave: () => this.cursor.hide(),
      pan: (dx, dy) => this.camera.panBy(dx, dy),
      fling: (vx, vy) => this.camera.fling(vx, vy),
      zoom: (dir, x, y) => this.camera.zoomStep(dir, x, y),
    }, () => this.brushEnabled);

    app.ticker.add(this.frame);
    this.frame(app.ticker);
    return true;
  }

  /**
   * Muestra un chunk recién descubierto: emerge de las nubes y la cámara se desliza hacia él.
   * Qué se descubre lo decide la lógica (SandworldService.revealNextChunk). La unión sin costuras
   * entre chunks llega en la fase 7.
   */
  showChunk(cx: number, cy: number): void {
    if (!this.clouds || this.terrains.has(chunkKey(cx, cy))) return;
    this.addChunk(cx, cy, true);
    // Los vecinos ya no tienen precipicio por ese lado: sus plantas pueden llegar hasta el borde compartido
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      this.terrains.get(chunkKey(cx + dx, cy + dy))?.layoutPlants(this.engine.time, this.revealed);
    }
    this.camera.setBounds(this.discoveredBounds(CLOUD_CAMERA_MARGIN));
    const N = WORLD.TILES;
    const c = isoToWorld(cx * N + N / 2 - 0.5, cy * N + N / 2 - 0.5);
    this.camera.glideTo(c.x, c.y);
  }

  /** El terreno de estos chunks ha cambiado: se re-hornearán en los próximos frames */
  /** La vegetación de estos chunks ha cambiado: se recolocan sus plantas */
  refreshPlants(chunks: readonly ChunkCoord[]): void {
    for (const c of chunks) this.terrains.get(chunkKey(c.cx, c.cy))?.layoutPlants(this.engine.time, this.revealed);
  }

  /** Cae un rayo en la celda global (gx, gy): rayo con ramas y destello */
  strike(gx: number, gy: number): void {
    const p = this.cellWorld(gx, gy);
    if (p) this.lightning.strike(p.x, p.y);
  }

  /** Lleva la cámara hasta la celda global (gx, gy) */
  focusCell(gx: number, gy: number): void {
    const p = this.cellWorld(gx, gy);
    if (p) this.camera.glideTo(p.x, p.y);
  }

  /** Punto del mundo de una celda global (null si su chunk no está dibujado) */
  private cellWorld(gx: number, gy: number): { x: number; y: number } | null {
    const C = WORLD.CELLS;
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    return this.terrains.get(chunkKey(cx, cy))?.cellPoint(gx - cx * C, gy - cy * C) ?? null;
  }

  markDirty(chunks: readonly ChunkCoord[]): void {
    for (const c of chunks) this.dirty.add(chunkKey(c.cx, c.cy));
  }

  /** Modo desarrollo: capa con la esencia y la afinidad, o con el bioma, de cada tile (null = ninguna) */
  setDevView(view: DevTileView | null): void {
    this.devViewWanted = view;
    this.devOverlay?.show(view);
  }

  setBrushEnabled(enabled: boolean): void {
    this.brushEnabled = enabled;
    if (!enabled) this.cursor.hide();
  }

  pause(): void {
    this.stage.pause();
  }

  resume(): void {
    this.stage.resume();
  }

  destroy(): void {
    this.destroyed = true;
    this.input?.destroy();
    this.input = null;
    for (const r of this.reveals) r.finish();
    this.reveals.length = 0;
    for (const t of this.terrains.values()) t.destroy();
    this.terrains.clear();
    this.clouds?.destroy();
    this.clouds = null;
    this.lightning.destroy();
    this.fauna.destroy();
    this.stage.destroy();
  }

  private frame = (ticker: Ticker): void => {
    const dt = ticker.deltaMS;
    this.now += dt;
    // Primero se dibuja lo que cambió en el frame anterior (p. ej. arena recién caída) y después avanza la física
    this.rebakeDirty();
    this.engine.update(dt);
    // Borde de pantalla: ratón quieto en el borde, o dedo vertiendo en la banda del borde
    const edge = this.input?.edgeVector() ?? { x: 0, y: 0 };
    const pourEdge = this.input?.brushEdgeVector(POUR_EDGE_BAND) ?? { x: 0, y: 0 };
    this.camera.update(dt, { x: edge.x + pourEdge.x, y: edge.y + pourEdge.y });
    // El dedo que vierte sigue vertiendo aunque no se mueva (el tiempo encima de un bloque cuenta)
    if (this.brushPoint) this.pourUnderFinger(dt);
    this.grains.update(dt);
    this.devOverlay?.update(dt);
    // Aspecto de estación de las plantas (cambia en días de juego: basta con mirarlo dos veces por segundo)
    for (const t of this.terrains.values()) t.animatePlants(dt);
    this.lightning.update(dt);
    const fauna = this.hooks.fauna?.();
    if (fauna) this.fauna.update(dt, fauna, this.groundAt, this.engine.isPaused);
    this.plantClock += dt;
    if (this.plantClock >= PLANT_LOOK_MS) {
      this.plantClock = 0;
      for (const t of this.terrains.values()) t.updatePlants(this.engine.time);
    }
    this.clouds?.update(dt);
    // Apariciones en curso (en tiempo real: siguen aunque el juego esté en pausa)
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      if (this.reveals[i].update(dt)) {
        this.reveals[i].blanket.destroy({ children: true });
        this.reveals.splice(i, 1);
      }
    }
    this.stage.world.scale.set(this.camera.scale);
    this.stage.world.position.set(this.camera.offsetX, this.camera.offsetY);
    const atmosphere = this.hooks.atmosphere?.();
    this.daylight?.apply(this.engine.exactMinuteOfDay, atmosphere?.season, atmosphere?.weather.gloom ?? 0);
    // La lluvia se ve también en pausa (queda quieta en el aire si el juego está parado)
    const weather = atmosphere?.weather;
    this.precipitation.update(this.engine.isPaused ? 0 : dt, weather?.look ?? 'none', weather?.intensity ?? 0);
    this.hooks.frame?.(ticker.lastTime);
  };

  /** Suelo de una celda global para los animales: el contenedor de su chunk y sus puntos del mundo */
  private readonly groundAt = (gx: number, gy: number): Ground | null => {
    const C = WORLD.CELLS;
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    const layer = this.terrains.get(chunkKey(cx, cy));
    if (!layer) return null;
    return { container: layer.plantsView, point: (x, y) => layer.floatPoint(x - cx * C, y - cy * C) };
  };

  /** Re-hornea los chunks cambiados, cada uno como mucho cada REBAKE_INTERVAL_MS */
  private rebakeDirty(): void {
    for (const key of this.dirty) {
      const layer = this.terrains.get(key);
      if (!layer) {
        this.dirty.delete(key);
        continue;
      }
      if (this.now - (this.lastBake.get(key) ?? -Infinity) < REBAKE_INTERVAL_MS) continue;
      const [cx, cy] = key.split(',').map(Number);
      layer.render(this.world.chunk(cx, cy));
      layer.layoutPlants(this.engine.time, this.revealed, true);
      this.lastBake.set(key, this.now);
      this.dirty.delete(key);
    }
  }

  /** Hornea un chunk, lo coloca en su orden de dibujo, extiende las nubes y (opcional) lo hace emerger */
  private addChunk(cx: number, cy: number, animate: boolean): void {
    const clouds = this.clouds!;
    const layer = new TerrainLayer(this.world.seed);
    layer.render(this.world.chunk(cx, cy));
    layer.layoutPlants(this.engine.time, this.revealed, true);
    layer.view.zIndex = cx + cy;                   // de atrás hacia delante en isométrica
    this.terrains.set(chunkKey(cx, cy), layer);
    this.stage.world.addChild(layer.view);

    clouds.cover(this.discoveredBounds(0));
    const shadow = clouds.castShadow(cx, cy);

    if (animate) {
      const fx = new RevealEffect(cx, cy, layer.view, shadow, clouds.puffTextures, this.world.seed + cx * 31 + cy * 17);
      this.stage.world.addChild(fx.blanket);
      this.reveals.push(fx);
    }
  }

  /** Rectángulo que ocupan todos los chunks descubiertos, ampliado `margin` px */
  private discoveredBounds(margin: number): Rect {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of this.terrains.values()) {
      const b = t.bounds;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
  }

  /** Vierte durante `dtMs` sobre el bloque bajo el dedo y suelta granos sobre él */
  private pourUnderFinger(dtMs: number): void {
    const pour = this.hooks.pour;
    if (!pour || !this.brushPoint) return;
    const area = this.areaAt(this.brushPoint.x, this.brushPoint.y);
    if (!area) return;
    const C = WORLD.CELLS;
    if (pour.at(area.cx * C + area.ci, area.cy * C + area.cj, dtMs / 1000)) {
      this.grains.emit(this.cursor.view.x, this.cursor.view.y, pour.color(), dtMs);
    }
  }

  /** Coloca el cursor sobre el bloque del pincel bajo un punto de pantalla. Devuelve si hay isla ahí. */
  private pointAt(sx: number, sy: number): boolean {
    return this.areaAt(sx, sy) !== null;
  }

  /** Bloque del pincel bajo un punto de pantalla (y coloca el cursor ahí), o null si no hay isla */
  private areaAt(sx: number, sy: number): BrushArea | null {
    const w = this.camera.screenToWorld(sx, sy);
    // El chunk más cercano a la cámara (mayor cx + cy) tapa a los de detrás
    const layers = [...this.terrains.values()].sort((a, b) => b.view.zIndex - a.view.zIndex);
    let cell = null;
    for (const l of layers) {
      cell = l.pick(w.x, w.y);
      if (cell) break;
    }
    if (!cell) {
      this.cursor.hide();
      return null;
    }
    const area: BrushArea = {
      cx: cell.cx,
      cy: cell.cy,
      ci: Math.floor(cell.ci / BRUSH_CELLS) * BRUSH_CELLS,
      cj: Math.floor(cell.cj / BRUSH_CELLS) * BRUSH_CELLS,
      surface: cell.surface,
    };
    this.cursor.show(area);
    return area;
  }
}
