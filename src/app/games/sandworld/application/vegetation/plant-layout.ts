import { ChunkData, PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { PLANT_DEFS, PLANT_MIN } from '../../config/plants.config';

/** Una planta dibujada: qué planta es, en qué celda del chunk y su semilla (para variar su ritmo de estación) */
export interface PlantInstance {
  readonly plant: number;
  readonly ci: number;
  readonly cj: number;
  readonly seed: number;
}

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
/** Separación mínima (en celdas) alrededor de cada planta: los árboles necesitan más sitio */
const GAP = { small: 1, bush: 1, tree: 2 } as const;
/** Agua (en niveles) por encima de la que no se dibuja una planta (las de orilla aguantan algo más) */
const DRY = 0.05;
const SHORE = 0.2;

const hash = (a: number, b: number, c: number): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const cache = new WeakMap<ChunkData, PlantInstance[]>();

/** La vegetación o el terreno del chunk han cambiado: hay que volver a repartir sus plantas */
export function invalidateLayout(chunk: ChunkData): void {
  cache.delete(chunk);
}

/**
 * Dónde se dibuja cada planta de un chunk. Determinista: con la misma vegetación salen siempre las mismas
 * posiciones, así las plantas no saltan de sitio al redibujar. En cada tile, cada planta pone tantos sprites
 * como su biomasa × su máximo (con redondeo al azar fijo), en celdas libres de agua, de suelo calcinado
 * y de otras plantas (con separación; los árboles van primero porque necesitan más sitio).
 */
export function layoutOf(chunk: ChunkData): readonly PlantInstance[] {
  const cached = cache.get(chunk);
  if (cached) return cached;
  const taken = new Uint8Array(WORLD.CELLS * WORLD.CELLS);
  const out: PlantInstance[] = [];
  const order = [...PLANT_DEFS].sort((a, b) => GAP[b.kind] - GAP[a.kind]);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const t = tileIndex(i, j);
      for (const p of order) {
        const b = chunk.plants[t * PLANT_SLOTS + p.id];
        if (b < PLANT_MIN) continue;
        const want = b * p.sprites;
        let count = Math.floor(want) + (hash(t, p.id, 7) < want - Math.floor(want) ? 1 : 0);
        // Las 16 celdas del tile en un orden fijo propio de esta planta
        const cells = Array.from({ length: G * G }, (_, n) => n).sort((x, y) => hash(t, p.id, x) - hash(t, p.id, y));
        for (const n of cells) {
          if (count <= 0) break;
          const ci = i * G + (n % G), cj = j * G + Math.floor(n / G);
          const k = cellIndex(ci, cj);
          if (chunk.water[k] > (p.shore ? SHORE : DRY) || chunk.material[k] === Material.CHARRED) continue;
          if (!free(taken, ci, cj, GAP[p.kind])) continue;
          taken[k] = GAP[p.kind] + 1;   // se guarda el hueco que necesita (los árboles, más)
          out.push({ plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99) });
          count--;
        }
      }
    }
  }
  cache.set(chunk, out);
  return out;
}

/** ¿Cabe aquí una planta que necesita `gap` celdas libres, respetando también el hueco de las que ya hay? */
function free(taken: Uint8Array, ci: number, cj: number, gap: number): boolean {
  const C = WORLD.CELLS;
  const R = 2;   // el hueco más grande (árboles)
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = ci + dx, y = cj + dy;
      if (x < 0 || y < 0 || x >= C || y >= C) continue;
      const other = taken[y * C + x];
      if (other && Math.max(Math.abs(dx), Math.abs(dy)) <= Math.max(gap, other - 1)) return false;
    }
  }
  return true;
}
