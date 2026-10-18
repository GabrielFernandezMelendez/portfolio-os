import { ChunkData, cellIndex, groundAt } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
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
  /** Se llama cuando cambia la altura de una celda (el agua de alrededor tiene que volver a moverse) */
  onHeightChange: ((gx: number, gy: number) => void) | null = null;

  constructor(private readonly world: World) {}

  cell(gx: number, gy: number): CellRef | null {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    return { chunk: this.world.chunk(cx, cy), k: cellIndex(gx - cx * C, gy - cy * C) };
  }

  ground(ref: CellRef): number {
    return groundAt(ref.chunk, ref.k);
  }

  /** Cambia el espesor de sedimento de una celda y avisa (el agua la recalcula el sistema de agua) */
  setSediment(ref: CellRef, sediment: number): void {
    const c = ref.chunk;
    c.sediment[ref.k] = Math.max(0, sediment);
    this.onHeightChange?.(c.cx * C + (ref.k % C), c.cy * C + Math.floor(ref.k / C));
  }

  /** Cambia el espesor de la capa helada (nieve o hielo) de una celda y avisa */
  setCover(ref: CellRef, cover: number): void {
    const c = ref.chunk;
    c.cover[ref.k] = Math.max(0, cover);
    this.onHeightChange?.(c.cx * C + (ref.k % C), c.cy * C + Math.floor(ref.k / C));
  }

  /** Clave numérica única de una celda global (para conjuntos de celdas activas) */
  static key(gx: number, gy: number): number {
    return (gx + 32768) * 65536 + (gy + 32768);
  }

  static fromKey(key: number): [number, number] {
    return [Math.floor(key / 65536) - 32768, (key % 65536) - 32768];
  }
}
