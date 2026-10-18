import { Graphics } from 'pixi.js';
import { WORLD } from '../domain/models/world.model';
import { BRUSH_CELLS } from '../config/brush.config';
import { isoToWorld } from './iso';

/** Zona que cubre el pincel: bloque de BRUSH_CELLS × BRUSH_CELLS celdas alineado a su rejilla */
export interface BrushArea {
  cx: number;
  cy: number;
  /** Primera celda del bloque */
  ci: number;
  cj: number;
  /** Altura visible bajo el dedo, en niveles */
  surface: number;
}

/** Rombo sobre la zona señalada. Es el futuro punto de caída del pincel de arena. */
export class CellCursor {
  readonly view = new Graphics();

  constructor() {
    const hw = (WORLD.TILE_W / WORLD.CELLS_PER_TILE) * BRUSH_CELLS / 2;   // a ×1: 10 px con BRUSH_CELLS = 2
    const hh = (WORLD.TILE_H / WORLD.CELLS_PER_TILE) * BRUSH_CELLS / 2;   // 5 px
    this.view
      .poly([0, -hh, hw, 0, 0, hh, -hw, 0])
      .fill({ color: 0xffffff, alpha: 0.35 })
      .stroke({ width: 1, color: 0xfff0cf, alpha: 0.9, alignment: 0.5 });
    this.view.zIndex = 10;
    this.view.visible = false;
  }

  show(area: BrushArea): void {
    const G = WORLD.CELLS_PER_TILE;
    // Centro del bloque en coordenadas de tile globales
    const u = area.cx * WORLD.TILES + (area.ci + BRUSH_CELLS / 2) / G - 0.5;
    const v = area.cy * WORLD.TILES + (area.cj + BRUSH_CELLS / 2) / G - 0.5;
    const p = isoToWorld(u, v, area.surface);
    this.view.position.set(p.x, p.y);
    this.view.visible = true;
  }

  hide(): void {
    this.view.visible = false;
  }
}
