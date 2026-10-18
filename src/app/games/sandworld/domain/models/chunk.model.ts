import { WORLD } from './world.model';

/**
 * Estado de un chunk en arrays tipados (sin objetos por celda: es lo que permite escalar a muchos chunks).
 *
 * Rejilla física (CELLS × CELLS):
 *   rock      altura de la roca madre, en niveles
 *   sediment  espesor del material suelto encima de la roca, en niveles
 *   material  MaterialId del sedimento
 *   water     lámina de agua libre encima del terreno, en niveles
 *   moisture  humedad del suelo (agua infiltrada), 0..1
 *   stagnant  días que lleva el agua de la celda sin correr
 *   spring    caudal de un manantial en la celda (niveles por minuto de juego), 0 = ninguno
 *   drain     agua que salió por el borde de la isla en el último minuto (para dibujar la cascada)
 *   ruleId / ruleTimer  regla de transformación en curso y días que lleva cumpliéndose
 *   pending / pendingSand  arena vertida que aún no se ha asentado (cantidad) y cuál (índice en SAND_ORDER + 1)
 *   cover / coverMaterial  capa helada encima de todo (nieve o hielo, en niveles): cuenta en la altura y se funde
 *   springBase  altura del terreno cuando nació el manantial: si se entierra por encima, el manantial se tapa
 *   heat      calor acumulado por la Brasa (se disipa); en exceso calcina el suelo
 *
 * Rejilla ecológica (TILES × TILES):
 *   temperature, humidity, fertility, essence, affinity  (0..1)
 *   tempShift desvío temporal de temperatura (Brasa lo sube, Escarcha lo baja; vuelve solo a 0)
 *   biome     BiomeId
 */
export interface ChunkData {
  readonly cx: number;
  readonly cy: number;

  readonly rock: Float32Array;
  readonly sediment: Float32Array;
  readonly material: Uint8Array;
  readonly water: Float32Array;
  readonly moisture: Float32Array;
  readonly stagnant: Float32Array;
  readonly spring: Float32Array;
  readonly drain: Float32Array;
  readonly cover: Float32Array;
  readonly coverMaterial: Uint8Array;
  readonly springBase: Float32Array;
  readonly heat: Float32Array;
  /** Caudal de salida hacia las 4 vecinas (E, O, S, N) por celda: la inercia del agua que corre */
  readonly flux: Float32Array;
  readonly ruleId: Uint8Array;
  readonly ruleTimer: Float32Array;
  readonly pending: Float32Array;
  readonly pendingSand: Uint8Array;

  readonly temperature: Float32Array;
  readonly humidity: Float32Array;
  readonly fertility: Float32Array;
  readonly essence: Float32Array;
  readonly affinity: Float32Array;
  readonly tempShift: Float32Array;
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
    moisture: new Float32Array(CELLS_TOTAL),
    stagnant: new Float32Array(CELLS_TOTAL),
    spring: new Float32Array(CELLS_TOTAL),
    drain: new Float32Array(CELLS_TOTAL),
    cover: new Float32Array(CELLS_TOTAL),
    coverMaterial: new Uint8Array(CELLS_TOTAL),
    springBase: new Float32Array(CELLS_TOTAL),
    heat: new Float32Array(CELLS_TOTAL),
    flux: new Float32Array(CELLS_TOTAL * 4),
    ruleId: new Uint8Array(CELLS_TOTAL),
    ruleTimer: new Float32Array(CELLS_TOTAL),
    pending: new Float32Array(CELLS_TOTAL),
    pendingSand: new Uint8Array(CELLS_TOTAL),
    temperature: new Float32Array(TILES_TOTAL),
    humidity: new Float32Array(TILES_TOTAL),
    fertility: new Float32Array(TILES_TOTAL),
    essence: new Float32Array(TILES_TOTAL),
    affinity: new Float32Array(TILES_TOTAL),
    tempShift: new Float32Array(TILES_TOTAL),
    biome: new Uint8Array(TILES_TOTAL),
  };
}

/** Índice de una celda (ci, cj) dentro de los arrays físicos */
export const cellIndex = (ci: number, cj: number): number => cj * WORLD.CELLS + ci;

/** Índice de un tile (i, j) dentro de los arrays ecológicos */
export const tileIndex = (i: number, j: number): number => j * WORLD.TILES + i;

/** Altura del terreno (roca + sedimento + capa helada) de una celda */
export const groundAt = (chunk: ChunkData, k: number): number => chunk.rock[k] + chunk.sediment[k] + chunk.cover[k];

/** Temperatura efectiva de un tile: la del clima más el desvío temporal de las arenas */
export const temperatureAt = (chunk: ChunkData, t: number): number => chunk.temperature[t] + chunk.tempShift[t];
