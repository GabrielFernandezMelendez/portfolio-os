import { ChunkData, cellIndex, createChunkData } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { WATER_TABLE } from '../../config/world.config';
import { clamp, fbm, smooth } from './noise';

/**
 * Genera la parte física de un chunk: roca, sedimento, material y agua estática.
 * Todo se calcula en coordenadas GLOBALES (en tiles), así montañas y valles continúan entre chunks.
 * El agua que fluye llega en la fase 2; aquí solo se rellenan los huecos por debajo del nivel freático.
 */
export function generateChunk(seed: number, cx: number, cy: number): ChunkData {
  const chunk = createChunkData(cx, cy);
  const G = WORLD.CELLS_PER_TILE;

  for (let cj = 0; cj < WORLD.CELLS; cj++) {
    for (let ci = 0; ci < WORLD.CELLS; ci++) {
      const k = cellIndex(ci, cj);
      // Centro de la celda en coordenadas de tile globales (el centro del tile i está en i)
      const gu = cx * WORLD.TILES + (ci + 0.5) / G - 0.5;
      const gv = cy * WORLD.TILES + (cj + 0.5) / G - 0.5;

      const ground = heightAt(seed, gu, gv);

      // Roca madre + capa de sedimento: más fina en las cumbres, más gruesa en los valles
      const sediment = 0.25 + 0.35 * (1 - clamp(ground / WORLD.MAX_LEVEL));
      chunk.rock[k] = Math.max(0.2, ground - sediment);
      chunk.sediment[k] = ground - chunk.rock[k];
      chunk.material[k] = Material.SOIL;

      // Agua estática: lo que queda por debajo del nivel freático se llena (lagos y cauces)
      chunk.water[k] = Math.max(0, WATER_TABLE - ground);
    }
  }
  return chunk;
}

/**
 * Altura del terreno (en niveles) en un punto global.
 * - continente: ondulación amplia (llanuras y mesetas)
 * - crestas:    ruido "ridged" que forma cordilleras
 * - cauces:     líneas donde el ruido cruza 0,5, talladas por debajo del nivel freático (ríos y lagos)
 */
export function heightAt(seed: number, gu: number, gv: number): number {
  const continent = fbm(gu * 0.11, gv * 0.11, seed + 101);
  const ridgeNoise = fbm(gu * 0.15 + 31.7, gv * 0.15 - 12.3, seed + 202);
  const ridges = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 3);

  let h = 0.6 + continent * 3.6 + ridges * 3.4;

  // Cauce: cuanto más cerca de 0,5 está este ruido, más se hunde el terreno
  const channelNoise = fbm(gu * 0.12 - 7.1, gv * 0.12 + 3.9, seed + 303);
  const distToChannel = Math.abs(channelNoise - 0.5);
  const carve = smooth(clamp(1 - distToChannel / 0.085));
  h = h * (1 - carve * 0.85) + (WATER_TABLE - 0.5) * carve * 0.85;

  return clamp(h, 0.2, WORLD.MAX_LEVEL + 0.9);
}
