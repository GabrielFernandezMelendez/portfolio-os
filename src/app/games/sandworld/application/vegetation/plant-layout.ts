import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { BURY_KILL, CROP_SPROUT_UNTIL, CROP_YOUNG_UNTIL, PLANT_DEFS, PLANT_MIN, SEEDLING } from '../../config/plants.config';
import { BIRTH_MARGIN, DEATH_MARGIN, REMAINS_DAYS, STAGE_DAYS } from '../../config/plant-life.config';
import { PlantKind } from '../../domain/models/plant.model';
import { BRUSH_CELLS } from '../../config/brush.config';

/** Una planta dibujada: qué planta es, en qué celda del chunk y su semilla (para variar su ritmo de estación) */
export interface PlantInstance {
  readonly plant: number;
  readonly ci: number;
  readonly cj: number;
  readonly seed: number;
  /** Minuto de juego en que nació (las silvestres crecen por etapas desde ahí); -Infinity = ya adulta */
  readonly born: number;
  /** Minuto de juego en que se comieron su fruto (vuelve poco a poco); -Infinity = nunca */
  eatenAt: number;
  /** Es un cultivo (sembrado): ocupa una casilla del cursor y se dibuja en su centro; ci, cj es su primera celda */
  readonly crop?: boolean;
  /** Crecimiento del cultivo (0..1): decide su etapa */
  readonly growth?: number;
}

/** Etapas de una planta: semilla, brote, joven y adulta */
export const Stage = { SEED: 0, SPROUT: 1, YOUNG: 2, ADULT: 3 } as const;
export type Stage = (typeof Stage)[keyof typeof Stage];

/** Por qué murió una planta: decide su animación y sus restos */
export type DeathCause = 'flood' | 'buried' | 'uprooted' | 'burnt' | 'cleared' | 'withered';

/** Una planta que acaba de morir (para animarla) */
export interface PlantDeath {
  readonly inst: PlantInstance;
  readonly cause: DeathCause;
}

/** Restos que deja una planta muerta durante unos días */
export type RemainsKind = 'stump' | 'log' | 'dryBush';
export interface PlantRemains {
  readonly kind: RemainsKind;
  readonly inst: PlantInstance;
  /** Minuto de juego en que quedó */
  readonly at: number;
  /** Causa de la muerte (un tronco caído al agua se va hundiendo) */
  readonly cause: DeathCause;
}

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
/** Separación mínima (en celdas) alrededor de cada planta silvestre: los árboles necesitan más sitio */
const GAP = { small: 1, bush: 1, tree: 2 } as const;
/**
 * Entre dos árboles, más: una casilla del cursor libre entre ellos (como los cultivos). Con sus copas anchas,
 * así cada árbol se distingue y se ve su sombra. La hierba y los arbustos sí pueden crecer cerca de un árbol.
 */
const TREE_TO_TREE = 3;
/** Lo que se guarda en el mapa de ocupación por celda: 0 libre, 1 pequeña o arbusto, 2 árbol */
const OCCUPIED = { small: 1, bush: 1, tree: 2 } as const;
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
 * Las muertes y los nacimientos se guardan hasta que el dibujo los recoge (para animarlos).
 */
interface ChunkPlants {
  edges: string;
  dirty: boolean;
  wild: WildPlant[];
  list: PlantInstance[];
  deaths: PlantDeath[];
  births: PlantInstance[];
  remains: PlantRemains[];
}

const state = new WeakMap<ChunkData, ChunkPlants>();

/** La vegetación o el terreno del chunk han cambiado: hay que revisar sus plantas (sin moverlas) */
export function invalidateLayout(chunk: ChunkData): void {
  const s = state.get(chunk);
  if (s) s.dirty = true;
}

/** Plantas que han muerto desde la última llamada (se vacía al leerla) */
export function takeDeaths(chunk: ChunkData): PlantDeath[] {
  return state.get(chunk)?.deaths.splice(0) ?? [];
}

/** Plantas que han nacido desde la última llamada (se vacía al leerla) */
export function takeBirths(chunk: ChunkData): PlantInstance[] {
  return state.get(chunk)?.births.splice(0) ?? [];
}

/** Restos que siguen en el chunk (tocones, troncos, matas secas) */
export function remainsOf(chunk: ChunkData): readonly PlantRemains[] {
  return state.get(chunk)?.remains ?? [];
}

/** Algo (un animal; de momento, el botón de desarrollo) se come el fruto de todas las plantas del chunk */
export function eatFruit(chunk: ChunkData, now: number): number {
  let n = 0;
  for (const inst of state.get(chunk)?.list ?? []) {
    if (!PLANT_DEFS[inst.plant].food) continue;
    inst.eatenAt = now;
    n++;
  }
  return n;
}

/** Etapa de una planta ahora: los cultivos según su crecimiento; las silvestres según su edad */
export function stageOf(inst: PlantInstance, now: number): Stage {
  if (inst.crop) {
    const g = inst.growth ?? 1;
    const CROP_SEED_UNTIL = SEEDLING * 1.5;
    return g < CROP_SEED_UNTIL ? Stage.SEED : g < CROP_SPROUT_UNTIL ? Stage.SPROUT : g < CROP_YOUNG_UNTIL ? Stage.YOUNG : Stage.ADULT;
  }
  const age = (now - inst.born) / 1440;
  const [sprout, young, adult] = STAGE_DAYS[PLANT_DEFS[inst.plant].kind];
  return age >= adult ? Stage.ADULT : age >= young ? Stage.YOUNG : age >= sprout ? Stage.SPROUT : Stage.SEED;
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
 * 2. Si la biomasa de una planta en un tile pide claramente menos sprites de los que hay (DEATH_MARGIN),
 *    se seca la más joven.
 * 3. Si pide claramente más (BIRTH_MARGIN), nace una nueva como semilla en una celda libre donde pueda crecer
 *    (canGrowAt), en un orden fijo por tile y planta, y crece por etapas. Si no cabe, la biomasa se ajusta a
 *    las que hay: lo que no cabe, no existe.
 * La primera vez (sin plantas previas) sale el reparto determinista de siempre, con las plantas ya adultas.
 * `now`: minuto de juego (edad de las que nacen y caducidad de los restos).
 */
export function layoutOf(chunk: ChunkData, revealed: RevealedFn, now = 0): readonly PlantInstance[] {
  // Qué bordes del chunk dan al precipicio: si cambia (se descubre un vecino), hay que revisar
  const edges = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => (revealed(chunk.cx + x, chunk.cy + y) ? 1 : 0)).join('');
  let st = state.get(chunk);
  if (st && !st.dirty && st.edges === edges) return st.list;
  const first = !st;
  if (!st) {
    st = { edges, dirty: true, wild: [], list: [], deaths: [], births: [], remains: [] };
    state.set(chunk, st);
  }
  const C = WORLD.CELLS;
  const taken = new Uint8Array(C * C);
  const crops: PlantInstance[] = [];
  const oldCrops = new Map(st.list.filter(i => i.crop).map(i => [cellIndex(i.ci, i.cj), i]));
  // Primero los cultivos: uno por casilla, en su centro (sin la separación de lo silvestre).
  // Sus celdas quedan ocupadas para las plantas silvestres, con su hueco alrededor.
  for (let k = 0; k < chunk.crop.length; k++) {
    if (!chunk.crop[k]) continue;
    const p = PLANT_DEFS[chunk.crop[k] - 1];
    const ci = k % C, cj = Math.floor(k / C);
    for (let dy = 0; dy < BRUSH_CELLS; dy++) {
      for (let dx = 0; dx < BRUSH_CELLS; dx++) {
        if (ci + dx < C && cj + dy < C) taken[cellIndex(ci + dx, cj + dy)] = OCCUPIED[p.kind];
      }
    }
    const old = oldCrops.get(k);
    const inst: PlantInstance = {
      plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99), born: old?.plant === p.id ? old.born : now,
      eatenAt: old?.plant === p.id ? old.eatenAt : -Infinity, crop: true, growth: chunk.cropGrowth[k],
    };
    crops.push(inst);
    if (!old || old.plant !== p.id) st.births.push(inst);
  }

  // 1. Las que ya estaban: siguen en su celda o mueren allí
  const alive: WildPlant[] = [];
  const deaths = new Set<number>();
  const die = (w: WildPlant, cause: DeathCause) => {
    st!.deaths.push({ inst: w.inst, cause });
    const kind = remainsKind(PLANT_DEFS[w.inst.plant].kind, cause);
    if (kind) st!.remains.push({ kind, inst: w.inst, at: now, cause });
  };
  for (const w of st.wild) {
    const p = PLANT_DEFS[w.inst.plant];
    const k = cellIndex(w.inst.ci, w.inst.cj);
    const cause = taken[k] ? 'cleared' : deathCause(chunk, k, w);
    if (cause) {
      const slot = w.tile * PLANT_SLOTS + p.id;
      chunk.plants[slot] = Math.max(0, chunk.plants[slot] - 1 / p.sprites);
      deaths.add(slot);
      die(w, cause);
      continue;
    }
    alive.push(w);
  }
  // Las que quedan ocupan su sitio antes de que nazca ninguna
  for (const w of alive) taken[cellIndex(w.inst.ci, w.inst.cj)] = OCCUPIED[PLANT_DEFS[w.inst.plant].kind];

  // 2 y 3. Cuántas pide cada planta en cada tile: sobran (se seca la más joven) o faltan (nace una)
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
        const want = wanted(b, p.sprites, t, p.id, group.length, first);
        // Sobran: se secan las últimas en nacer
        for (let n = group.length - 1; n >= want; n--) {
          removed.add(group[n]);
          taken[cellIndex(group[n].inst.ci, group[n].inst.cj)] = 0;
          die(group[n], 'withered');
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
          if (!free(taken, ci, cj, p.kind)) continue;
          taken[k] = OCCUPIED[p.kind];
          // La primera vez la isla ya tiene su vegetación crecida; después, todo nace como semilla
          const inst: PlantInstance = { plant: p.id, ci, cj, seed: hash(ci, cj, p.id + 99), born: first ? -Infinity : now, eatenAt: -Infinity };
          born.push({ inst, tile: t, ground: groundAt(chunk, k) });
          if (!first) st.births.push(inst);
          missing--;
        }
        // No cabe ninguna más: la biomasa se queda en lo que hay dibujado
        if (missing > 0) chunk.plants[slot] = (want - missing) / p.sprites;
      }
    }
  }
  st.wild = [...alive.filter(w => !removed.has(w)), ...born];
  st.list = [...crops, ...st.wild.map(w => w.inst)];
  // Los restos caducan (y desaparecen si algo ha crecido encima)
  st.remains = st.remains.filter(r => (now - r.at) / 1440 < REMAINS_DAYS[r.kind] && !taken[cellIndex(r.inst.ci, r.inst.cj)]);
  st.edges = edges;
  st.dirty = false;
  return st.list;
}

/**
 * Sprites que pide una biomasa (biomasa × máximo). La primera vez, con el redondeo al azar fijo de cada tile
 * y planta; después, con margen respecto a las que ya hay: nace una solo si sobra BIRTH_MARGIN de planta y
 * muere una solo si falta DEATH_MARGIN (así no mueren y renacen plantas por una biomasa que oscila en el límite).
 */
function wanted(b: number, sprites: number, t: number, plant: number, have: number, first: boolean): number {
  if (b < PLANT_MIN) return 0;
  const x = b * sprites;
  if (first) return Math.floor(x) + (hash(t, plant, 7) < x - Math.floor(x) ? 1 : 0);
  let n = have;
  while (x >= n + BIRTH_MARGIN) n++;
  while (n > 0 && x < n - DEATH_MARGIN) n--;
  return n;
}

/** ¿Por qué ya no puede vivir en su celda una planta nacida? null si sigue bien (un charco no la mata) */
function deathCause(chunk: ChunkData, k: number, w: WildPlant): DeathCause | null {
  const p = PLANT_DEFS[w.inst.plant];
  if (chunk.material[k] === Material.CHARRED) return 'burnt';
  const change = groundAt(chunk, k) - w.ground;
  const limit = BURY_KILL[p.kind] * UPROOT_PART;
  if (change > limit) return 'buried';
  if (change < -limit) return 'uprooted';
  if (chunk.water[k] > (p.shore ? DROWN_SHORE : DROWN[p.kind])) return 'flood';
  return null;
}

/** Qué queda de una planta según su tamaño y cómo murió */
function remainsKind(kind: PlantKind, cause: DeathCause): RemainsKind | null {
  if (cause === 'buried' || cause === 'cleared') return null;
  if (kind === 'tree') return cause === 'withered' ? 'stump' : 'log';
  if (kind === 'bush' && (cause === 'withered' || cause === 'burnt')) return 'dryBush';
  return null;
}

/** ¿Cabe aquí una planta de este tipo, respetando su hueco y el de las que ya hay? (entre árboles, más) */
function free(taken: Uint8Array, ci: number, cj: number, kind: PlantKind): boolean {
  const C = WORLD.CELLS;
  const R = TREE_TO_TREE;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = ci + dx, y = cj + dy;
      if (x < 0 || y < 0 || x >= C || y >= C) continue;
      const other = taken[y * C + x];
      if (!other) continue;
      const otherTree = other === OCCUPIED.tree;
      const need = kind === 'tree' && otherTree ? TREE_TO_TREE : Math.max(GAP[kind], otherTree ? GAP.tree : GAP.small);
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= need) return false;
    }
  }
  return true;
}
