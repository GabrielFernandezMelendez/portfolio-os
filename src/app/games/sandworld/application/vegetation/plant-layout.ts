import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { BURY_KILL, CROP_SPROUT_UNTIL, PLANT_DEFS, PLANT_MIN } from '../../config/plants.config';
import { BRUSH_CELLS } from '../../config/brush.config';

/** Una planta dibujada: qué planta es, en qué celda del chunk y su semilla (para variar su ritmo de estación) */
export interface PlantInstance {
  readonly plant: number;
  readonly ci: number;
  readonly cj: number;
  readonly seed: number;
  /** Es un cultivo (sembrado): ocupa una casilla del cursor y se dibuja en su centro; ci, cj es su primera celda */
  readonly crop?: boolean;
  /** Cultivo aún pequeño: se dibuja como brote */
  readonly sprout?: boolean;
}

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
/** Separación mínima (en celdas) alrededor de cada planta silvestre: los árboles necesitan más sitio */
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
/**
 * Una planta ya nacida aguanta más que lo que hace falta para nacer (si no, cualquier charco de lluvia la mataría):
 * muere ahogada si el agua de su celda pasa de esto (las de orilla aguantan más)...
 */
const DROWN = { small: 0.05, bush: 0.08, tree: 0.12 } as const;
const DROWN_SHORE = 0.25;
/** ...o enterrada o descalzada si el suelo de su celda sube o baja más que esta parte de BURY_KILL */
const UPROOT_PART = 0.5;

/** ¿Está descubierto el chunk (cx, cy)? Lo da el mapa de exploración: los bordes con lo no descubierto son precipicio */
export type RevealedFn = (cx: number, cy: number) => boolean;

const hash = (a: number, b: number, c: number): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Planta silvestre ya colocada: recuerda la altura del suelo de su celda al nacer (para saber si la entierran) */
interface WildPlant {
  readonly inst: PlantInstance;
  readonly tile: number;
  readonly ground: number;
}

/**
 * Plantas de cada chunk. Las silvestres son persistentes: una vez nacida, una planta vive en su celda y no se
 * mueve nunca. Si su celda se inunda, se entierra o se calcina, muere allí mismo. `dirty`: hay que revisarlas.
 */
interface ChunkPlants {
  edges: string;
  dirty: boolean;
  wild: WildPlant[];
  list: PlantInstance[];
}

const state = new WeakMap<ChunkData, ChunkPlants>();

/** La vegetación o el terreno del chunk han cambiado: hay que revisar sus plantas (sin moverlas) */
export function invalidateLayout(chunk: ChunkData): void {
  const s = state.get(chunk);
  if (s) s.dirty = true;
}

/**
 * ¿Se puede poner una planta en esta celda? Solo en suelo llano por el que se podría caminar:
 * - lejos del borde de la isla (el precipicio al mar de nubes), con más margen para los árboles
 * - sin desnivel con sus vecinas (no en el borde de una terraza)
 * - ni ella ni sus vecinas con agua (así nada asoma en medio de un lago); el junco sí tolera agua poco honda,
 *   pero solo en la orilla (con tierra seca al lado)
 * - sin suelo calcinado
 */
export function canGrowAt(
  chunk: ChunkData, ci: number, cj: number, kind: keyof typeof GAP, shore: boolean, revealed: RevealedFn, crop = false,
): boolean {
  const C = WORLD.CELLS;
  // Los cultivos los cuida alguien: pueden acercarse una celda más al borde (nunca estar en él)
  const m = crop ? Math.max(1, EDGE_MARGIN[kind] - 1) : EDGE_MARGIN[kind];
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
 * ¿Cabe un cultivo en la casilla cuya primera celda es (ci, cj)? Como mucho uno por casilla;
 * un árbol necesita que en las casillas de alrededor no haya otro árbol (una casilla libre entre árboles).
 */
export function cropFits(chunk: ChunkData, ci: number, cj: number, kind: keyof typeof GAP): boolean {
  const C = WORLD.CELLS, B = BRUSH_CELLS;
  if (chunk.crop[cellIndex(ci, cj)]) return false;
  if (kind !== 'tree') return true;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = ci + dx * B, y = cj + dy * B;
      if (x < 0 || y < 0 || x >= C || y >= C) continue;
      const other = chunk.crop[cellIndex(x, y)];
      if (other && PLANT_DEFS[other - 1].kind === 'tree') return false;
    }
  }
  return true;
}

/**
 * Las plantas que se dibujan en un chunk. Las silvestres no se recolocan nunca; en cada revisión:
 * 1. Mueren en su sitio las que ya no pueden vivir en su celda: ahogadas (agua honda), enterradas o descalzadas
 *    (el suelo subió o bajó mucho: Duna, Marea, desprendimientos) o calcinadas, y las que tapa un cultivo nuevo.
 *    Cada muerte resta su parte de biomasa al tile: así no "reaparece" en otra celda.
 * 2. Si la biomasa de una planta en un tile pide menos sprites de los que hay, mueren los más jóvenes.
 * 3. Si pide más, nacen nuevos en celdas libres donde pueda crecer (canGrowAt), en un orden fijo por tile y planta.
 *    Si no cabe ninguno más, la biomasa se ajusta a los que hay: lo que no cabe, no existe.
 * La primera vez (sin plantas previas) sale el mismo reparto determinista de siempre.
 */
export function layoutOf(chunk: ChunkData, revealed: RevealedFn): readonly PlantInstance[] {
  // Qué bordes del chunk dan al precipicio: si cambia (se descubre un vecino), hay que revisar
  const edges = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => (revealed(chunk.cx + x, chunk.cy + y) ? 1 : 0)).join('');
  let st = state.get(chunk);
  if (st && !st.dirty && st.edges === edges) return st.list;
  if (!st) {
    st = { edges, dirty: true, wild: [], list: [] };
    state.set(chunk, st);
  }
  const C = WORLD.CELLS;
  const taken = new Uint8Array(C * C);
  const crops: PlantInstance[] = [];
  // Primero los cultivos: uno por casilla, en su centro (sin la separación de lo silvestre).
  // Sus celdas quedan ocupadas para las plantas silvestres, con su hueco alrededor.
  for (let k = 0; k < chunk.crop.length; k++) {
    if (!chunk.crop[k]) continue;
    const p = PLANT_DEFS[chunk.crop[k] - 1];
    const ci = k % C, cj = Math.floor(k / C);
    for (let dy = 0; dy < BRUSH_CELLS; dy++) {
      for (let dx = 0; dx < BRUSH_CELLS; dx++) {
        if (ci + dx < C && cj + dy < C) taken[cellIndex(ci + dx, cj + dy)] = GAP[p.kind] + 1;
      }
    }
    crops.push({ plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99), crop: true, sprout: chunk.cropGrowth[k] < CROP_SPROUT_UNTIL });
  }

  // 1. Las que ya estaban: siguen en su celda o mueren allí
  const alive: WildPlant[] = [];
  const deaths = new Set<number>();
  for (const w of st.wild) {
    const p = PLANT_DEFS[w.inst.plant];
    const k = cellIndex(w.inst.ci, w.inst.cj);
    if (taken[k] || !survives(chunk, k, w)) {
      const slot = w.tile * PLANT_SLOTS + p.id;
      chunk.plants[slot] = Math.max(0, chunk.plants[slot] - 1 / p.sprites);
      deaths.add(slot);
      continue;
    }
    alive.push(w);
  }
  // Las que quedan ocupan su sitio antes de que nazca ninguna
  for (const w of alive) taken[cellIndex(w.inst.ci, w.inst.cj)] = GAP[PLANT_DEFS[w.inst.plant].kind] + 1;

  // 2 y 3. Cuántas pide cada planta en cada tile: sobran (mueren las más jóvenes) o faltan (nacen)
  const byTilePlant = new Map<number, WildPlant[]>();
  for (const w of alive) {
    const key = w.tile * PLANT_SLOTS + w.inst.plant;
    let group = byTilePlant.get(key);
    if (!group) byTilePlant.set(key, (group = []));
    group.push(w);
  }
  // Donde ha muerto alguna, la biomasa del tile baja también a lo que queda dibujado (sin restos que rebroten al lado)
  for (const slot of deaths) {
    const p = PLANT_DEFS[slot % PLANT_SLOTS];
    chunk.plants[slot] = Math.min(chunk.plants[slot], (byTilePlant.get(slot)?.length ?? 0) / p.sprites);
  }
  const removed = new Set<WildPlant>();
  const born: WildPlant[] = [];
  const order = [...PLANT_DEFS].sort((a, b) => GAP[b.kind] - GAP[a.kind]);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const t = tileIndex(i, j);
      for (const p of order) {
        const slot = t * PLANT_SLOTS + p.id;
        const b = chunk.plants[slot];
        const group = byTilePlant.get(slot) ?? [];
        const want = b < PLANT_MIN ? 0 : wanted(b, p.sprites, t, p.id);
        // Sobran: mueren las últimas en nacer
        for (let n = group.length - 1; n >= want; n--) {
          removed.add(group[n]);
          taken[cellIndex(group[n].inst.ci, group[n].inst.cj)] = 0;
        }
        let missing = want - group.length;
        if (missing <= 0) continue;
        // Faltan: nacen en las 16 celdas del tile en un orden fijo propio de esta planta
        const cells = Array.from({ length: G * G }, (_, n) => n).sort((x, y) => hash(t, p.id, x) - hash(t, p.id, y));
        for (const n of cells) {
          if (missing <= 0) break;
          const ci = i * G + (n % G), cj = j * G + Math.floor(n / G);
          const k = cellIndex(ci, cj);
          if (!canGrowAt(chunk, ci, cj, p.kind, !!p.shore, revealed)) continue;
          if (!free(taken, ci, cj, GAP[p.kind])) continue;
          taken[k] = GAP[p.kind] + 1;   // se guarda el hueco que necesita (los árboles, más)
          born.push({ inst: { plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99) }, tile: t, ground: groundAt(chunk, k) });
          missing--;
        }
        // No cabe ninguna más: la biomasa se queda en lo que hay dibujado
        if (missing > 0) chunk.plants[slot] = (want - missing) / p.sprites;
      }
    }
  }
  st.wild = [...alive.filter(w => !removed.has(w)), ...born];
  st.list = [...crops, ...st.wild.map(w => w.inst)];
  st.edges = edges;
  st.dirty = false;
  return st.list;
}

/** Sprites que pide una biomasa: biomasa × máximo, con el redondeo al azar fijo de cada tile y planta */
function wanted(b: number, sprites: number, t: number, plant: number): number {
  const want = b * sprites;
  return Math.floor(want) + (hash(t, plant, 7) < want - Math.floor(want) ? 1 : 0);
}

/** ¿Sigue viva en su celda una planta ya nacida? (más tolerante que nacer: un charco no la mata) */
function survives(chunk: ChunkData, k: number, w: WildPlant): boolean {
  const p = PLANT_DEFS[w.inst.plant];
  if (chunk.material[k] === Material.CHARRED) return false;
  if (chunk.water[k] > (p.shore ? DROWN_SHORE : DROWN[p.kind])) return false;
  return Math.abs(groundAt(chunk, k) - w.ground) <= BURY_KILL[p.kind] * UPROOT_PART;
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
