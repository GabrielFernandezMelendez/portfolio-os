import { Ticker } from 'pixi.js';
import { PixiStage } from './rendering/pixi-stage';
import { TerrainLayer } from './rendering/terrain/terrain-layer';
import { Camera } from './rendering/camera';
import { CellCursor } from './rendering/cell-cursor';
import { DaylightLayer } from './rendering/daylight-layer';
import { PointerInput } from './infrastructure/input/pointer-input';
import { TimeEngine } from './application/time/time-engine';
import { World } from './application/world/world';
import { BRUSH_CELLS } from './config/brush.config';

/** Avisos del runtime hacia fuera (el componente los conecta con el servicio) */
export interface RuntimeHooks {
  /** Cada frame, con el tiempo real actual en ms */
  frame?(nowMs: number): void;
  /** Toque sobre la isla sin arena seleccionada */
  islandTap?(): void;
}

/**
 * Raíz de composición del juego en marcha: une motor de tiempo, render, cámara y entrada.
 * El componente Angular solo crea esto, lo monta y lo destruye.
 * Cada frame: avanza el tiempo → mueve la cámara → aplica la luz del día.
 */
export class SandworldRuntime {
  private readonly stage = new PixiStage();
  private readonly camera = new Camera();
  private readonly cursor = new CellCursor();
  private terrain: TerrainLayer | null = null;
  private daylight: DaylightLayer | null = null;
  private input: PointerInput | null = null;
  private destroyed = false;
  /** true cuando hay una arena seleccionada (fase 2 / HUD del bloque 4). Sin arena, 1 dedo mueve la cámara. */
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

    // Chunk inicial (0,0), ya generado por el mundo
    this.terrain = new TerrainLayer(this.world.seed);
    this.terrain.render(this.world.chunk(0, 0));
    this.stage.world.addChild(this.terrain.view, this.cursor.view);

    this.camera.setViewport(app.screen.width, app.screen.height);
    this.camera.setBounds(this.terrain.bounds);
    this.camera.fit();

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
    this.terrain?.destroy();
    this.terrain = null;
    this.stage.destroy();
  }

  private frame = (ticker: Ticker): void => {
    const dt = ticker.deltaMS;
    this.engine.update(dt);
    this.camera.update(dt, this.input?.edgeVector() ?? { x: 0, y: 0 });
    this.stage.world.scale.set(this.camera.scale);
    this.stage.world.position.set(this.camera.offsetX, this.camera.offsetY);
    this.daylight?.apply(this.engine.exactMinuteOfDay);
    this.hooks.frame?.(ticker.lastTime);
  };

  /** Coloca el cursor sobre el bloque del pincel bajo un punto de pantalla. Devuelve si hay isla ahí. */
  private pointAt(sx: number, sy: number): boolean {
    const w = this.camera.screenToWorld(sx, sy);
    const cell = this.terrain?.pick(w.x, w.y) ?? null;
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
