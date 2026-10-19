import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
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
/** Celdas libres hasta el borde de la isla (el precipicio al mar de nubes): los árboles son más anchos */
const EDGE_MARGIN = { small: 1, bush: 1, tree: 2 } as const;
/**
 * Agua (en niveles) por encima de la que una celda o sus vecinas se consideran agua. Es el mismo umbral
 * a partir del cual el terreno ya dibuja una lámina de agua: si se ve agua, no hay planta.
 */
const DRY = 0.004;
/** Las plantas de orilla (junco) sí pueden estar en agua muy poco honda, pegadas a tierra */
const SHORE = 0.1;
/** Desnivel máximo con una vecina para que el suelo cuente como llano (el borde de una terraza no lo es) */
const FLAT = 0.5;

/** ¿Está descubierto el chunk (cx, cy)? Lo da el mapa de exploración: los bordes con lo no descubierto son precipicio */
export type RevealedFn = (cx: number, cy: number) => boolean;

const hash = (a: number, b: number, c: number): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const cache = new WeakMap<ChunkData, { readonly edges: string; readonly list: PlantInstance[] }>();

/** La vegetación o el terreno del chunk han cambiado: hay que volver a repartir sus plantas */
export function invalidateLayout(chunk: ChunkData): void {
  cache.delete(chunk);
}

/**
 * ¿Se puede poner una planta en esta celda? Solo en suelo llano por el que se podría caminar:
 * - lejos del borde de la isla (el precipicio al mar de nubes), con más margen para los árboles
 * - sin desnivel con sus vecinas (no en el borde de una terraza)
 * - ni ella ni sus vecinas con agua (así nada asoma en medio de un lago); el junco sí tolera agua poco honda,
 *   pero solo en la orilla (con tierra seca al lado)
 * - sin suelo calcinado
 */
export function canGrowAt(chunk: ChunkData, ci: number, cj: number, kind: keyof typeof GAP, shore: boolean, revealed: RevealedFn): boolean {
  const C = WORLD.CELLS;
  const m = EDGE_MARGIN[kind];
  if ((ci < m && !revealed(chunk.cx - 1, chunk.cy)) || (ci >= C - m && !revealed(chunk.cx + 1, chunk.cy)) ||
      (cj < m && !revealed(chunk.cx, chunk.cy - 1)) || (cj >= C - m && !revealed(chunk.cx, chunk.cy + 1))) return false;
  const k = cellIndex(ci, cj);
  if (chunk.material[k] === Material.CHARRED) return false;
  if (chunk.water[k] > (shore ? SHORE : DRY)) return false;
  const g = groundAt(chunk, k);
  let dryNeighbour = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ci + dx, y = cj + dy;
      if (x < 0 || y < 0 || x >= C || y >= C) continue;
      const n = cellIndex(x, y);
      if ((dx === 0 || dy === 0) && chunk.water[n] <= DRY) dryNeighbour = true;
      if (!shore && chunk.water[n] > DRY) return false;
      if ((dx === 0 || dy === 0) && Math.abs(groundAt(chunk, n) - g) > FLAT) return false;
    }
  }
  // El junco crece en la orilla, no en medio del lago: necesita tierra seca justo al lado (no en diagonal)
  return !shore || chunk.water[k] <= DRY || dryNeighbour;
}

/**
 * Dónde se dibuja cada planta de un chunk. Determinista: con la misma vegetación y el mismo terreno salen
 * siempre las mismas posiciones, así las plantas no saltan de sitio al redibujar. En cada tile, cada planta
 * pone tantos sprites como su biomasa × su máximo (con redondeo al azar fijo), en celdas donde puede crecer
 * (canGrowAt) y libres de otras plantas (con separación; los árboles van primero porque necesitan más sitio).
 */
export function layoutOf(chunk: ChunkData, revealed: RevealedFn): readonly PlantInstance[] {
  // Qué bordes del chunk dan al precipicio: si cambia (se descubre un vecino), hay que repartir de nuevo
  const edges = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => (revealed(chunk.cx + x, chunk.cy + y) ? 1 : 0)).join('');
  const cached = cache.get(chunk);
  if (cached && cached.edges === edges) return cached.list;
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
          if (!canGrowAt(chunk, ci, cj, p.kind, !!p.shore, revealed)) continue;
          if (!free(taken, ci, cj, GAP[p.kind])) continue;
          taken[k] = GAP[p.kind] + 1;   // se guarda el hueco que necesita (los árboles, más)
          out.push({ plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99) });
          count--;
        }
      }
    }
  }
  cache.set(chunk, { edges, list: out });
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
