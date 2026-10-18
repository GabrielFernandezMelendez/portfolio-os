import { Ticker } from 'pixi.js';
import { PixiStage } from './rendering/pixi-stage';
import { TerrainLayer } from './rendering/terrain/terrain-layer';
import { Camera, Rect } from './rendering/camera';
import { CellCursor } from './rendering/cell-cursor';
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
import { ChunkCoord } from './domain/events/game-events';

/** Avisos del runtime hacia fuera (el componente los conecta con el servicio) */
export interface RuntimeHooks {
  /** Cada frame, con el tiempo real actual en ms */
  frame?(nowMs: number): void;
  /** Toque sobre la isla sin arena seleccionada */
  islandTap?(): void;
}

const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;

/**
 * Raíz de composición del juego en marcha: une motor de tiempo, render, cámara y entrada.
 * El componente Angular solo crea esto, lo monta y lo destruye.
 * Cada frame: avanza el tiempo → mueve la cámara → nubes y apariciones → luz del día.
 */
export class SandworldRuntime {
  private readonly stage = new PixiStage();
  private readonly camera = new Camera();
  private readonly cursor = new CellCursor();
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

  constructor(
    private readonly engine: TimeEngine,
    private readonly world: World,
    private readonly hooks: RuntimeHooks = {},
  ) {}

  /** Devuelve false si se destruyó antes de terminar de cargar */
  async mount(host: HTMLElement): Promise<boolean> {
    const app = await this.stage.mount(host, (w, h) => this.camera.setViewport(w, h));
    if (!app || this.destroyed) return false;

    // Mar de nubes detrás de todo; la isla flota encima
    this.clouds = new CloudLayer(this.world.seed);
    this.stage.world.addChild(this.clouds.back, this.cursor.view);

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
        // Fase 2: aquí caerá la arena. De momento el pincel solo mueve el cursor de celda.
        if (phase === 'cancel') this.cursor.hide();
        else this.pointAt(x, y);
      },
      hover: (x, y) => this.pointAt(x, y),
      tap: (x, y) => {
        if (this.pointAt(x, y)) this.hooks.islandTap?.();
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
    this.camera.setBounds(this.discoveredBounds(CLOUD_CAMERA_MARGIN));
    const N = WORLD.TILES;
    const c = isoToWorld(cx * N + N / 2 - 0.5, cy * N + N / 2 - 0.5);
    this.camera.glideTo(c.x, c.y);
  }

  /** El terreno de estos chunks ha cambiado: se re-hornearán en los próximos frames */
  markDirty(chunks: readonly ChunkCoord[]): void {
    for (const c of chunks) this.dirty.add(chunkKey(c.cx, c.cy));
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
    this.stage.destroy();
  }

  private frame = (ticker: Ticker): void => {
    const dt = ticker.deltaMS;
    this.now += dt;
    // Primero se dibuja lo que cambió en el frame anterior (p. ej. arena recién caída) y después avanza la física
    this.rebakeDirty();
    this.engine.update(dt);
    this.camera.update(dt, this.input?.edgeVector() ?? { x: 0, y: 0 });
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
    this.daylight?.apply(this.engine.exactMinuteOfDay);
    this.hooks.frame?.(ticker.lastTime);
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
      this.lastBake.set(key, this.now);
      this.dirty.delete(key);
    }
  }

  /** Hornea un chunk, lo coloca en su orden de dibujo, extiende las nubes y (opcional) lo hace emerger */
  private addChunk(cx: number, cy: number, animate: boolean): void {
    const clouds = this.clouds!;
    const layer = new TerrainLayer(this.world.seed);
    layer.render(this.world.chunk(cx, cy));
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

  /** Coloca el cursor sobre el bloque del pincel bajo un punto de pantalla. Devuelve si hay isla ahí. */
  private pointAt(sx: number, sy: number): boolean {
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
      return false;
    }
    this.cursor.show({
      cx: cell.cx,
      cy: cell.cy,
      ci: Math.floor(cell.ci / BRUSH_CELLS) * BRUSH_CELLS,
      cj: Math.floor(cell.cj / BRUSH_CELLS) * BRUSH_CELLS,
      surface: cell.surface,
    });
    return true;
  }
}
