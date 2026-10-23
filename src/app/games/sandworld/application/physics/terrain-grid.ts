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
  /** Talud extra de una celda (raíces de las plantas); lo pone quien conoce la vegetación */
  reposeBonus: ((ref: CellRef) => number) | null = null;

  /**
   * Chunks descubiertos por clave numérica: `cell()` se llama millones de veces por minuto de juego (el agua) y
   * buscar el chunk por su clave de texto era lo más caro. Solo se guardan los descubiertos (un chunk no se
   * vuelve a tapar), así que no hace falta invalidar nada.
   */
  private readonly chunks = new Map<number, ChunkData>();

  constructor(private readonly world: World) {}

  cell(gx: number, gy: number): CellRef | null {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    const id = (cx + 1024) * 2048 + (cy + 1024);
    let chunk = this.chunks.get(id);
    if (!chunk) {
      if (!this.world.exploration.isRevealed(cx, cy)) return null;
      chunk = this.world.chunk(cx, cy);
      this.chunks.set(id, chunk);
    }
    return { chunk, k: cellIndex(gx - cx * C, gy - cy * C) };
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

  /** Cambia la altura de la roca madre de una celda (solo la Marea la rebaja) y avisa */
  setRock(ref: CellRef, rock: number): void {
    const c = ref.chunk;
    c.rock[ref.k] = rock;
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
