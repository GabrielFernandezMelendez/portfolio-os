import { MATERIALS } from '../../config/materials.config';
import { MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { LANDSLIDE_EPSILON, LANDSLIDE_MAX_CELLS, LANDSLIDE_RATE } from '../../config/physics.config';
import { CellRef, TerrainGrid } from './terrain-grid';

const NEIGHBOURS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Talud extra (en niveles) con el suelo empapado */
const WET_REPOSE_BONUS = 0.3;

/** Niveles que tienen que caer sobre una celda para que su capa de arriba pase a ser ese material */
const MATERIAL_COVER = 0.04;

/**
 * Desprendimientos (talud): si el desnivel con una vecina supera el talud del material de la celda,
 * el sobrante cae hacia ella. Solo se mueve sedimento: la roca no se desliza.
 *
 * Solo se procesan las celdas "activas" (las que han cambiado y sus vecinas), así el coste depende
 * de lo que se mueve, no del tamaño de la isla. El terreno generado no se toca hasta que algo lo despierta.
 * La masa se conserva exactamente: lo que sale de una celda entra en sus vecinas.
 */
export class LandslideSystem {
  private active = new Set<number>();

  constructor(private readonly grid: TerrainGrid) {}

  get activeCount(): number {
    return this.active.size;
  }

  /** Marca una celda (y sus vecinas) para revisarlas en la próxima pasada */
  wake(gx: number, gy: number): void {
    this.active.add(TerrainGrid.key(gx, gy));
    for (const [dx, dy] of NEIGHBOURS) this.active.add(TerrainGrid.key(gx + dx, gy + dy));
  }

  /**
   * Una pasada sobre las celdas activas. Devuelve las claves de chunk ("cx,cy") que han cambiado.
   * Las celdas que siguen moviéndose quedan activas para la siguiente pasada.
   */
  step(changedChunks: Set<string> = new Set()): Set<string> {
    if (this.active.size === 0) return changedChunks;
    const batch: number[] = [];
    for (const k of this.active) {
      batch.push(k);
      if (batch.length >= LANDSLIDE_MAX_CELLS) break;
    }
    for (const k of batch) this.active.delete(k);

    const C = WORLD.CELLS;
    for (const key of batch) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const sediment = cell.chunk.sediment[cell.k];
      if (sediment <= 0) continue;

      const material = cell.chunk.material[cell.k] as MaterialId;
      // El material mojado aguanta más pendiente (arena de playa); el barro ya tiene su talud bajo
      const repose = MATERIALS[material].repose + cell.chunk.moisture[cell.k] * WET_REPOSE_BONUS;
      if (!Number.isFinite(repose)) continue;

      const h = this.grid.ground(cell);
      // Excesos sobre el talud hacia cada vecina más baja
      const targets: { ref: CellRef; gx: number; gy: number; move: number }[] = [];
      let total = 0;
      for (const [dx, dy] of NEIGHBOURS) {
        const n = this.grid.cell(gx + dx, gy + dy);
        if (!n) continue;                                   // borde de lo descubierto: muro
        const excess = h - this.grid.ground(n) - repose;
        if (excess <= LANDSLIDE_EPSILON) continue;
        const move = excess * LANDSLIDE_RATE;
        targets.push({ ref: n, gx: gx + dx, gy: gy + dy, move });
        total += move;
      }
      if (total === 0) continue;

      // No puede salir más sedimento del que hay
      const scale = total > sediment ? sediment / total : 1;
      this.grid.setSediment(cell, sediment - total * scale);
      for (const t of targets) {
        const amount = t.move * scale;
        this.grid.setSediment(t.ref, t.ref.chunk.sediment[t.ref.k] + amount);
        // Lo que cae cubre a la vecina, si es una capa apreciable (un grano suelto no cambia su color)
        if (amount >= MATERIAL_COVER) t.ref.chunk.material[t.ref.k] = material;
        this.wake(t.gx, t.gy);
        changedChunks.add(`${Math.floor(t.gx / C)},${Math.floor(t.gy / C)}`);
      }
      this.wake(gx, gy);
      changedChunks.add(`${Math.floor(gx / C)},${Math.floor(gy / C)}`);
    }
    return changedChunks;
  }
}
