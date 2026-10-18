import { WORLD } from './world.model';

/**
 * Estado de un chunk en arrays tipados (sin objetos por celda: es lo que permite escalar a muchos chunks).
 *
 * Rejilla física (CELLS × CELLS):
 *   rock      altura de la roca madre, en niveles
 *   sediment  espesor del material suelto encima de la roca, en niveles
 *   material  MaterialId del sedimento
 *   water     lámina de agua libre encima del terreno, en niveles
 *
 * Rejilla ecológica (TILES × TILES):
 *   temperature, humidity, fertility, essence  (0..1)
 *   biome     BiomeId
 */
export interface ChunkData {
  readonly cx: number;
  readonly cy: number;

  readonly rock: Float32Array;
  readonly sediment: Float32Array;
  readonly material: Uint8Array;
  readonly water: Float32Array;

  readonly temperature: Float32Array;
  readonly humidity: Float32Array;
  readonly fertility: Float32Array;
  readonly essence: Float32Array;
  readonly biome: Uint8Array;
}

const CELLS_TOTAL = WORLD.CELLS * WORLD.CELLS;
const TILES_TOTAL = WORLD.TILES * WORLD.TILES;

export function createChunkData(cx: number, cy: number): ChunkData {
  return {
    cx,
    cy,
    rock: new Float32Array(CELLS_TOTAL),
    sediment: new Float32Array(CELLS_TOTAL),
    material: new Uint8Array(CELLS_TOTAL),
    water: new Float32Array(CELLS_TOTAL),
    temperature: new Float32Array(TILES_TOTAL),
    humidity: new Float32Array(TILES_TOTAL),
    fertility: new Float32Array(TILES_TOTAL),
    essence: new Float32Array(TILES_TOTAL),
    biome: new Uint8Array(TILES_TOTAL),
  };
}

/** Índice de una celda (ci, cj) dentro de los arrays físicos */
export const cellIndex = (ci: number, cj: number): number => cj * WORLD.CELLS + ci;

/** Índice de un tile (i, j) dentro de los arrays ecológicos */
export const tileIndex = (i: number, j: number): number => j * WORLD.TILES + i;

/** Altura del terreno (roca + sedimento) de una celda */
export const groundAt = (chunk: ChunkData, k: number): number => chunk.rock[k] + chunk.sediment[k];
