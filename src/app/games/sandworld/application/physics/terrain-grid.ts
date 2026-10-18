import { ChunkData, cellIndex, groundAt } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { WATER_TABLE } from '../../config/world.config';
import { World } from '../world/world';

const C = WORLD.CELLS;

/** Referencia a una celda: su chunk y su índice dentro de él */
export interface CellRef {
  chunk: ChunkData;
  k: number;
}

/**
 * Vista de todas las celdas físicas de los chunks descubiertos como una sola rejilla global.
 * Coordenadas globales de celda: gx = cx * 32 + ci, gy = cy * 32 + cj.
 * Fuera de lo descubierto no hay celdas (null): la física lo trata como un muro.
 */
export class TerrainGrid {
  constructor(private readonly world: World) {}

  cell(gx: number, gy: number): CellRef | null {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    return { chunk: this.world.chunk(cx, cy), k: cellIndex(gx - cx * C, gy - cy * C) };
  }

  ground(ref: CellRef): number {
    return groundAt(ref.chunk, ref.k);
  }

  /**
   * Cambia el espesor de sedimento de una celda y recoloca el agua estática.
   * Agua estática: hasta que llegue el agua dinámica (bloque 2), lo que queda por debajo del nivel freático se llena.
   */
  setSediment(ref: CellRef, sediment: number): void {
    const c = ref.chunk;
    c.sediment[ref.k] = Math.max(0, sediment);
    c.water[ref.k] = Math.max(0, WATER_TABLE - groundAt(c, ref.k));
  }

  /** Clave numérica única de una celda global (para conjuntos de celdas activas) */
  static key(gx: number, gy: number): number {
    return (gx + 32768) * 65536 + (gy + 32768);
  }

  static fromKey(key: number): [number, number] {
    return [Math.floor(key / 65536) - 32768, (key % 65536) - 32768];
  }
}
