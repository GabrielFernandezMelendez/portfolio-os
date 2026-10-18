import { ChunkData, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Biome, landBiomeOf } from '../../domain/models/biome.model';
import { WORLD } from '../../domain/models/world.model';
import { clamp, fbm } from './noise';

/** Fracción de agua a partir de la cual un tile se considera humedal */
const WETLAND_WATER_FRACTION = 0.45;

/**
 * Clima inicial de cada tile a partir de la parte física del chunk:
 * - temperatura: un gradiente amplio con ruido (zonas cálidas y frías) que baja con la altura
 * - humedad:     ruido amplio + cercanía al agua
 * - bioma:       humedal si hay mucha agua; si no, según temperatura y humedad
 * En la fase 3 este cálculo pasa a ser dinámico (hora, estación, arenas).
 */
export function computeClimate(chunk: ChunkData, seed: number): void {
  const G = WORLD.CELLS_PER_TILE;

  for (let j = 0; j < WORLD.TILES; j++) {
    for (let i = 0; i < WORLD.TILES; i++) {
      // Media de las 16 celdas del tile
      let groundSum = 0;
      let wetCells = 0;
      for (let dj = 0; dj < G; dj++) {
        for (let di = 0; di < G; di++) {
          const k = cellIndex(i * G + di, j * G + dj);
          groundSum += groundAt(chunk, k);
          if (chunk.water[k] > 0.05) wetCells++;
        }
      }
      const altitude = groundSum / (G * G);
      const waterFraction = wetCells / (G * G);

      const gu = chunk.cx * WORLD.TILES + i;
      const gv = chunk.cy * WORLD.TILES + j;

      const baseTemp = 0.3 + 0.6 * fbm(gu * 0.13 + 5.3, gv * 0.13 - 2.1, seed + 404);
      const temperature = clamp(baseTemp - (altitude - 2.5) * 0.13);

      const nearWater = waterNearby(chunk, i, j);
      const humidity = clamp(0.1 + 0.7 * fbm(gu * 0.14 - 9.4, gv * 0.14 + 6.6, seed + 505) + nearWater * 0.35);

      const t = tileIndex(i, j);
      chunk.temperature[t] = temperature;
      chunk.humidity[t] = humidity;
      chunk.biome[t] = waterFraction > WETLAND_WATER_FRACTION ? Biome.WETLAND : landBiomeOf(temperature, humidity);
      chunk.fertility[t] = chunk.biome[t] === Biome.FOREST ? 0.6 : chunk.biome[t] === Biome.WETLAND ? 0.7 : 0.25;
      chunk.essence[t] = 0;
    }
  }
}

/** 0..1 según cuánta agua hay en el tile y sus vecinos inmediatos */
function waterNearby(chunk: ChunkData, i: number, j: number): number {
  const G = WORLD.CELLS_PER_TILE;
  let wet = 0;
  let total = 0;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ti = i + di;
      const tj = j + dj;
      if (ti < 0 || tj < 0 || ti >= WORLD.TILES || tj >= WORLD.TILES) continue;
      for (let cj = 0; cj < G; cj += 2) {
        for (let ci = 0; ci < G; ci += 2) {
          total++;
          if (chunk.water[cellIndex(ti * G + ci, tj * G + cj)] > 0.05) wet++;
        }
      }
    }
  }
  return total ? clamp((wet / total) * 3) : 0;
}
