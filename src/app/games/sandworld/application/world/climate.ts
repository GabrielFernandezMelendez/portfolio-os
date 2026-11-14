import { ChunkData, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Biome } from '../../domain/models/biome.model';
import { BIOME_BY_ID, classifyBiome } from '../../config/biomes.config';
import { tileContext } from './tile-context';
import { WORLD } from '../../domain/models/world.model';
import { clamp, fbm } from './noise';

/**
 * Clima inicial de cada tile a partir de la parte física del chunk:
 * - temperatura: un gradiente amplio con ruido (zonas cálidas y frías) que baja con la altura
 * - humedad:     ruido amplio + cercanía al agua
 * - bioma:       el que toque según el registro de biomas (al empezar no hay barro, ceniza ni roca desnuda)
 * Después los biomas cambian solos con el estado del terreno (BiomeSystem).
 */
export function computeClimate(chunk: ChunkData, seed: number): void {
  const G = WORLD.CELLS_PER_TILE;

  for (let j = 0; j < WORLD.TILES; j++) {
    for (let i = 0; i < WORLD.TILES; i++) {
      // Media de las 16 celdas del tile
      let groundSum = 0;
      for (let dj = 0; dj < G; dj++) {
        for (let di = 0; di < G; di++) {
          const k = cellIndex(i * G + di, j * G + dj);
          groundSum += groundAt(chunk, k);
        }
      }
      const altitude = groundSum / (G * G);

      const gu = chunk.cx * WORLD.TILES + i;
      const gv = chunk.cy * WORLD.TILES + j;

      const baseTemp = 0.3 + 0.6 * fbm(gu * 0.13 + 5.3, gv * 0.13 - 2.1, seed + 404);
      const temperature = clamp(baseTemp - (altitude - 2.5) * 0.13);

      const nearWater = waterNearby(chunk, i, j);
      const humidity = clamp(0.1 + 0.7 * fbm(gu * 0.14 - 9.4, gv * 0.14 + 6.6, seed + 505) + nearWater * 0.35);

      const t = tileIndex(i, j);
      chunk.temperature[t] = temperature;
      chunk.humidity[t] = humidity;
      chunk.essence[t] = 0;
      // Fertilidad inicial según el clima (el bioma se decide con ella)
      chunk.fertility[t] = temperature < 0.34 || (temperature > 0.64 && humidity < 0.5) ? 0.25 : 0.6;
      const biome = classifyBiome(tileContext(chunk, i, j));
      chunk.biome[t] = biome;
      chunk.biomeNext[t] = biome;
      if (biome === Biome.WETLAND) chunk.fertility[t] = 0.7;
      const fixed = BIOME_BY_ID[biome].fertility;
      if (fixed !== undefined) chunk.fertility[t] = fixed;
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
