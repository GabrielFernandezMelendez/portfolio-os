import { ChunkData, cellIndex, groundAt } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { NATURAL_SPRING_MIN_LEVEL, NATURAL_SPRING_RATE } from '../../config/water.config';
import { hash2 } from './noise';

/** Distancia mínima (en celdas) entre dos manantiales del mismo chunk */
const MIN_SEPARATION = 12;

/**
 * Manantiales naturales: 1 o 2 por chunk en sus cumbres, para que haya ríos desde el principio.
 * Deterministas por semilla (el mismo mapa siempre tiene los mismos ríos). El chunk inicial (0,0)
 * siempre tiene al menos uno si alguna cumbre llega a la altura mínima.
 */
export function placeNaturalSprings(chunk: ChunkData, seed: number): void {
  const C = WORLD.CELLS;
  // Cumbres: celdas más altas que sus 8 vecinas, de más alta a más baja
  const peaks: { k: number; h: number }[] = [];
  for (let cj = 1; cj < C - 1; cj++) {
    for (let ci = 1; ci < C - 1; ci++) {
      const k = cellIndex(ci, cj);
      const h = groundAt(chunk, k);
      if (h < NATURAL_SPRING_MIN_LEVEL) continue;
      let top = true;
      for (let dj = -1; dj <= 1 && top; dj++) {
        for (let di = -1; di <= 1; di++) {
          if ((di || dj) && groundAt(chunk, cellIndex(ci + di, cj + dj)) > h) { top = false; break; }
        }
      }
      if (top) peaks.push({ k, h });
    }
  }
  peaks.sort((a, b) => b.h - a.h);

  const isStart = chunk.cx === 0 && chunk.cy === 0;
  const wanted = hash2(chunk.cx, chunk.cy, seed + 777) < 0.5 ? 2 : 1;
  const chance = isStart ? 1 : 0.7;
  if (hash2(chunk.cx, chunk.cy, seed + 778) > chance) return;

  const placed: number[] = [];
  for (const p of peaks) {
    if (placed.length >= wanted) break;
    const ci = p.k % C, cj = Math.floor(p.k / C);
    const far = placed.every(k => Math.hypot((k % C) - ci, Math.floor(k / C) - cj) >= MIN_SEPARATION);
    if (!far) continue;
    chunk.spring[p.k] = NATURAL_SPRING_RATE;
    placed.push(p.k);
  }
}
