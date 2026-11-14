import { SandId } from '../../domain/models/sand.model';
import { BRUSH_CELLS } from '../../config/brush.config';
import { POUR_DWELL_SECONDS, STROKE_TOTAL_CAP } from '../../config/pour.config';
import { SAND_EFFECTS } from './sand-effects';
import { TerrainGrid } from '../physics/terrain-grid';

/**
 * Un trazo del pincel mientras el dedo está apoyado.
 * Cada bloque de BRUSH_CELLS×BRUSH_CELLS celdas acumula arena según el tiempo que el dedo pasa encima,
 * con rendimiento decreciente: max × (1 − e^(−t/τ)). El trazo entero tiene un tope (STROKE_TOTAL_CAP).
 */
export class Stroke {
  /** Cantidad por celda global (clave de TerrainGrid) */
  readonly cells = new Map<number, number>();
  /** Segundos que el dedo lleva sobre cada bloque */
  private readonly dwell = new Map<number, number>();
  private total = 0;
  private readonly maxPerCell: number;

  constructor(readonly sand: SandId) {
    this.maxPerCell = SAND_EFFECTS[sand].maxPerCell;
  }

  /** Fracción que le queda al trazo (1 = botella llena, 0 = vacía) */
  get remaining(): number {
    return Math.max(0, 1 - this.total / STROKE_TOTAL_CAP);
  }

  get poured(): number {
    return this.total;
  }

  /**
   * El dedo pasa `seconds` sobre el bloque cuya primera celda es (gx0, gy0).
   * Devuelve las celdas que han recibido arena en este paso (para la capa visible y los granos).
   */
  pour(gx0: number, gy0: number, seconds: number): [number, number, number][] {
    if (this.remaining <= 0 || seconds <= 0) return [];
    const blockKey = TerrainGrid.key(gx0, gy0);
    const t0 = this.dwell.get(blockKey) ?? 0;
    const t1 = t0 + seconds;
    this.dwell.set(blockKey, t1);
    // Lo que cae en este intervalo según la curva de rendimiento decreciente
    let perCell = this.maxPerCell * (Math.exp(-t0 / POUR_DWELL_SECONDS) - Math.exp(-t1 / POUR_DWELL_SECONDS));
    const cellsInBlock = BRUSH_CELLS * BRUSH_CELLS;
    perCell = Math.min(perCell, (STROKE_TOTAL_CAP - this.total) / cellsInBlock);
    if (perCell <= 0) return [];

    const changed: [number, number, number][] = [];
    for (let dy = 0; dy < BRUSH_CELLS; dy++) {
      for (let dx = 0; dx < BRUSH_CELLS; dx++) {
        const key = TerrainGrid.key(gx0 + dx, gy0 + dy);
        this.cells.set(key, (this.cells.get(key) ?? 0) + perCell);
        changed.push([gx0 + dx, gy0 + dy, perCell]);
      }
    }
    this.total += perCell * cellsInBlock;
    return changed;
  }
}
