import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { PlantDef, VegetationChange } from '../../domain/models/plant.model';
import { BiomeId, TileContext } from '../../domain/models/biome.model';
import { SeasonId } from '../../domain/models/time.model';
import { WORLD } from '../../domain/models/world.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BIOME_BY_ID } from '../../config/biomes.config';
import {
  CROP_CAPACITY_BONUS, CROP_CARE_DAYS, CROP_GROWTH_BONUS, CROP_REGROW_FROM, PLANT_DEFS, PLANT_MIN, PLANT_SPACE,
  SEASON_GROWTH, SEEDLING,
} from '../../config/plants.config';
import { World } from '../world/world';
import { tileContext } from '../world/tile-context';
import { RevealedFn, canGrowAt, cropFits, invalidateLayout } from './plant-layout';
import { BRUSH_CELLS } from '../../config/brush.config';
import { Material } from '../../domain/models/material.model';
import { HUMUS_DECAY_DAYS, HUMUS_KEEP_BIOMASS } from '../../config/sand-effects.config';

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
const NEIGHBOURS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Media de altura del tile (para detectar arena que entierra o tierra que se excava) */
function tileGround(chunk: ChunkData, i: number, j: number): number {
  let s = 0;
  for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) s += groundAt(chunk, cellIndex(i * G + di, j * G + dj));
  return s / (G * G);
}

/** Cuánto encaja un valor en un rango cómodo: 1 dentro, cae a 0 a 0,15 fuera */
function fit(v: number, min: number, max: number): number {
  if (v < min) return Math.max(0, 1 - (min - v) / 0.15);
  if (v > max) return Math.max(0, 1 - (v - max) / 0.15);
  return 1;
}

/**
 * Biomasa máxima (0..1) que puede tener una planta en un tile ahora: bioma, temperatura (clima medio del tile,
 * no la estación), humedad del suelo o del clima, fertilidad, roca, nieve permanente, agua y suelo calcinado.
 */
export function plantCapacity(p: PlantDef, ctx: TileContext, biome: BiomeId): number {
  const weight = p.biomes[BIOME_BY_ID[biome].key] ?? 0;
  if (weight <= 0 || ctx.charred > 0.3) return 0;
  if (p.gladeOnly && !ctx.glade) return 0;
  const wet = Math.max(ctx.moisture, ctx.humidity * 0.8, ctx.water > 0 ? 0.6 : 0);
  const moisture = wet >= p.moisture ? 1 : Math.max(0, wet / Math.max(0.01, p.moisture));
  const fertility = ctx.fertility >= p.fertility ? 1 : Math.max(0, ctx.fertility / Math.max(0.01, p.fertility));
  // Suelo útil: sin roca desnuda (salvo musgo y liquen), sin nieve permanente (salvo las de frío)
  // y sin agua encima (salvo las de orilla, que aguantan algo)
  const ground = (1 - (p.rock ? 0 : ctx.rock)) * (1 - (p.snow ? 0 : ctx.cover)) * (1 - ctx.water * (p.shore ? 0.3 : 1));
  return Math.max(0, Math.min(1, weight * fit(ctx.temperature, p.temperature[0], p.temperature[1]) * moisture * fertility * ground));
}

/**
 * Cuánto sufre una planta de un tile (0 = bien, 1 = muriéndose): lo lejos que está lo que el tile le permite ahora
 * (sequía, frío, sal…) de la biomasa que tiene. Lo usa el dibujo para irla apagando hacia ocre y marrón.
 */
export function plantStress(chunk: ChunkData, i: number, j: number, plant: number): number {
  const t = tileIndex(i, j);
  const b = chunk.plants[t * PLANT_SLOTS + plant];
  if (b <= 0) return 0;
  const cap = plantCapacity(PLANT_DEFS[plant], tileContext(chunk, i, j), chunk.biome[t] as BiomeId);
  return Math.max(0, Math.min(1, (b - cap) / Math.max(0.2, b)));
}

/** Talud extra que dan las raíces de las plantas del tile de esta celda (árboles y sauce) */
export function rootsAt(chunk: ChunkData, k: number): number {
  const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
  const base = tileIndex(Math.floor(ci / G), Math.floor(cj / G)) * PLANT_SLOTS;
  let r = 0;
  for (const p of PLANT_DEFS) if (p.roots) r += p.roots * chunk.plants[base + p.id];
  return r;
}

/**
 * Vegetación. Tres formas de que nazca una planta:
 * 1. Natural (por tile): la biomasa de cada planta se acerca a lo que el tile permite (crece despacio, según su
 *    ritmo y la estación; muere más deprisa si las condiciones empeoran), compiten por el espacio, la enredadera
 *    ahoga, las bien crecidas siembran tiles vecinos y la arena que cae de golpe entierra. Es lo que mantiene
 *    la densidad de la isla cuando nadie interviene.
 * 2. Semillas (germinate): las deja un animal que se la comió; solo germinan donde la planta podría crecer sola
 *    y queda sitio, así que no suben la densidad: solo ayudan a que llegue antes a donde ya podría estar.
 * 3. Cultivos (sow / harvest, por casilla del cursor): los siembra una especie evolucionada; como mucho uno por
 *    casilla (los árboles con una casilla libre entre ellos), crecen mejor porque están cuidados y, si nadie
 *    los cuida durante CROP_CARE_DAYS, se asilvestran y pasan a ser vegetación natural.
 */
export class VegetationSystem {
  /** Chunks cuyo suelo ha cambiado (humus que se descompone): hay que volver a dibujarlos */
  private readonly soilChanges = new Set<string>();

  constructor(
    private readonly world: World,
    private readonly random: RandomSource,
  ) {}

  /** Vegetación inicial de un chunk recién generado (determinista por semilla) */
  static seed(chunk: ChunkData, random: RandomSource): void {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const t = tileIndex(i, j);
        const ctx = tileContext(chunk, i, j);
        chunk.vegGround[t] = tileGround(chunk, i, j);
        for (const p of PLANT_DEFS) {
          const cap = plantCapacity(p, ctx, chunk.biome[t] as BiomeId);
          const presence = (p.biomes[BIOME_BY_ID[chunk.biome[t] as BiomeId].key] ?? 0) * 0.7;
          if (cap > 0.05 && random.next() < presence) chunk.plants[t * PLANT_SLOTS + p.id] = cap * (0.4 + 0.6 * random.next());
        }
        VegetationSystem.limitSpace(chunk, t);
      }
    }
  }

  // ── Semillas y cultivos (los usarán la fauna y las especies evolucionadas) ──

  /**
   * Un animal que comió `plant` deja una semilla en la celda global (gx, gy). Con la probabilidad de semilla
   * de la planta, germina si la planta podría crecer allí sola y queda sitio en el tile. Devuelve si germinó.
   */
  germinate(plant: number, gx: number, gy: number): boolean {
    const p = PLANT_DEFS[plant];
    if (!p.seeds || this.random.next() >= p.seeds) return false;
    const where = this.tileAt(gx, gy);
    if (!where) return false;
    const { chunk, i, j } = where;
    const t = tileIndex(i, j);
    const k = t * PLANT_SLOTS + p.id;
    if (chunk.plants[k] >= SEEDLING) return false;
    if (plantCapacity(p, tileContext(chunk, i, j), chunk.biome[t] as BiomeId) < 0.1) return false;
    let used = 0;
    for (const q of PLANT_DEFS) used += chunk.plants[t * PLANT_SLOTS + q.id] * PLANT_SPACE[q.kind];
    if (used + SEEDLING * PLANT_SPACE[p.kind] > 1) return false;
    chunk.plants[k] = SEEDLING;
    invalidateLayout(chunk);
    return true;
  }

  /**
   * Siembra un cultivo en la casilla (la que se selecciona con el cursor: BRUSH_CELLS × BRUSH_CELLS celdas)
   * que contiene la celda global (gx, gy). Hace falta suelo llano y seco en toda la casilla (como cualquier
   * planta), que la planta pueda vivir en ese clima y bioma, y sitio: como mucho un cultivo por casilla,
   * y los árboles con al menos una casilla libre entre ellos.
   */
  sow(plant: number, gx: number, gy: number, revealed: RevealedFn): boolean {
    const p = PLANT_DEFS[plant];
    const where = this.blockAt(gx, gy);
    if (!where) return false;
    const { chunk, ci, cj } = where;
    for (let dy = 0; dy < BRUSH_CELLS; dy++) {
      for (let dx = 0; dx < BRUSH_CELLS; dx++) {
        if (!canGrowAt(chunk, ci + dx, cj + dy, p.kind, !!p.shore, revealed, true)) return false;
      }
    }
    if (!cropFits(chunk, ci, cj, p.kind)) return false;
    const t = tileIndex(Math.floor(ci / G), Math.floor(cj / G));
    if (plantCapacity(p, tileContext(chunk, Math.floor(ci / G), Math.floor(cj / G)), chunk.biome[t] as BiomeId) <= 0) return false;
    const k = cellIndex(ci, cj);
    chunk.crop[k] = p.id + 1;
    chunk.cropGrowth[k] = SEEDLING;
    chunk.cropCare[k] = CROP_CARE_DAYS;
    invalidateLayout(chunk);
    return true;
  }

  /**
   * Cosecha el cultivo de la casilla que contiene la celda global (gx, gy). Devuelve cuánta comida da (su crecimiento × su nutrición;
   * 0 si no hay cultivo o no da comida en esta estación). Los que rebrotan vuelven a crecer; el resto desaparece.
   */
  harvest(gx: number, gy: number, season: SeasonId): number {
    const where = this.blockAt(gx, gy);
    if (!where) return 0;
    const { chunk, ci, cj } = where;
    const k = cellIndex(ci, cj);
    if (!chunk.crop[k]) return 0;
    const p = PLANT_DEFS[chunk.crop[k] - 1];
    const food = p.food && (!p.food.seasons || p.food.seasons.includes(season)) ? chunk.cropGrowth[k] * p.food.nutrition : 0;
    if (p.regrows) {
      chunk.cropGrowth[k] = Math.min(chunk.cropGrowth[k], CROP_REGROW_FROM);
      chunk.cropCare[k] = CROP_CARE_DAYS;
    } else {
      chunk.crop[k] = 0;
      chunk.cropGrowth[k] = 0;
      chunk.cropCare[k] = 0;
    }
    invalidateLayout(chunk);
    return food;
  }

  /** Revisa toda la vegetación descubierta. Devuelve los chunks cuyo aspecto ha cambiado. */
  update(elapsedDays: number, season: SeasonId): VegetationChange[] {
    const changed: VegetationChange[] = [];
    for (const { cx, cy } of this.world.exploration.list()) {
      const chunk = this.world.chunk(cx, cy);
      let visible = false;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          if (this.updateTile(chunk, i, j, elapsedDays, season)) visible = true;
        }
      }
      if (this.updateCrops(chunk, elapsedDays, season)) visible = true;
      this.decayHumus(chunk, elapsedDays);
      if (visible) {
        invalidateLayout(chunk);
        changed.push({ cx, cy });
      }
    }
    return changed;
  }

  /** Chunks cuyo suelo ha cambiado desde la última llamada (se vacía al leerla) */
  takeSoilChanges(): { cx: number; cy: number }[] {
    const out = [...this.soilChanges].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    });
    this.soilChanges.clear();
    return out;
  }

  /**
   * El humus sin plantas que lo renueven se descompone poco a poco en tierra normal (de media en HUMUS_DECAY_DAYS):
   * hay que mantener viva la orilla para que siga protegiéndola.
   */
  private decayHumus(chunk: ChunkData, dt: number): void {
    const chance = dt / HUMUS_DECAY_DAYS;
    for (let k = 0; k < chunk.material.length; k++) {
      if (chunk.material[k] !== Material.HUMUS) continue;
      const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
      const base = tileIndex(Math.floor(ci / G), Math.floor(cj / G)) * PLANT_SLOTS;
      let biomass = 0;
      for (const p of PLANT_DEFS) biomass += chunk.plants[base + p.id];
      if (biomass >= HUMUS_KEEP_BIOMASS || this.random.next() >= chance) continue;
      chunk.material[k] = Material.SOIL;
      this.soilChanges.add(`${chunk.cx},${chunk.cy}`);
    }
  }

  /** Actualiza un tile. Devuelve si alguna planta ha cambiado de forma visible (décimas de biomasa). */
  private updateTile(chunk: ChunkData, i: number, j: number, dt: number, season: SeasonId): boolean {
    const t = tileIndex(i, j);
    const base = t * PLANT_SLOTS;
    const ctx = tileContext(chunk, i, j);
    const biome = chunk.biome[t] as BiomeId;
    const before = this.signature(chunk, base);

    // Arena que entierra o tierra que se va: lo resuelve cada planta en su celda (plant-layout: mueren allí mismo)
    chunk.vegGround[t] = tileGround(chunk, i, j);

    const growth = SEASON_GROWTH[season];
    let vine = 0;
    for (const p of PLANT_DEFS) {
      const k = base + p.id;
      let b = chunk.plants[k];
      const cap = plantCapacity(p, ctx, biome);
      if (b > 0) {
        if (cap > b) b = Math.min(cap, b + (dt / p.growthDays) * growth);
        else b = Math.max(cap, b - (dt * 2) / p.growthDays);
        if (b < PLANT_MIN * 0.5 && cap <= 0) b = 0;
        chunk.plants[k] = b;
        // Siembra: una planta bien crecida coloniza un tile vecino donde pueda crecer
        if (b > 0.5 && growth > 0 && this.random.next() < p.spread * dt) this.seedNeighbour(chunk, i, j, p);
      }
      if (p.invasive) vine += p.invasive * chunk.plants[k];
      if (p.essence && chunk.plants[k] > 0) chunk.essence[t] = Math.min(1, chunk.essence[t] + p.essence * chunk.plants[k] * dt);
    }
    // La enredadera ahoga arbustos y árboles
    if (vine > 0) {
      for (const p of PLANT_DEFS) {
        if (p.kind === 'small' || p.invasive) continue;
        chunk.plants[base + p.id] = Math.max(0, chunk.plants[base + p.id] - vine * dt);
      }
    }
    VegetationSystem.limitSpace(chunk, t);
    return this.signature(chunk, base) !== before;
  }

  /**
   * Cultivos: crecen con ventaja (están cuidados) hasta un poco más de lo que el tile permitiría a una silvestre;
   * el cuidado se gasta con los días y, sin cuidado, el cultivo se asilvestra: pasa a la biomasa del tile.
   * Devuelve si alguno ha cambiado de forma visible.
   */
  private updateCrops(chunk: ChunkData, dt: number, season: SeasonId): boolean {
    let visible = false;
    const growth = SEASON_GROWTH[season];
    for (let k = 0; k < chunk.crop.length; k++) {
      if (!chunk.crop[k]) continue;
      const p = PLANT_DEFS[chunk.crop[k] - 1];
      const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
      const i = Math.floor(ci / G), j = Math.floor(cj / G), t = tileIndex(i, j);
      const before = Math.floor(chunk.cropGrowth[k] * 10);
      const cap = Math.min(1, plantCapacity(p, tileContext(chunk, i, j), chunk.biome[t] as BiomeId) * CROP_CAPACITY_BONUS);
      const g = chunk.cropGrowth[k];
      chunk.cropGrowth[k] = cap > g ? Math.min(cap, g + (dt / p.growthDays) * growth * CROP_GROWTH_BONUS) : Math.max(cap, g - (dt * 2) / p.growthDays);
      chunk.cropCare[k] -= dt;
      if (chunk.cropCare[k] <= 0 || chunk.cropGrowth[k] <= 0) {
        // Sin cuidado: se asilvestra (su biomasa pasa al tile, sin pasarse de lo que el tile permite)
        const w = t * PLANT_SLOTS + p.id;
        chunk.plants[w] = Math.min(Math.max(cap, chunk.plants[w]), chunk.plants[w] + chunk.cropGrowth[k] / (G * G));
        chunk.crop[k] = 0;
        chunk.cropGrowth[k] = 0;
        chunk.cropCare[k] = 0;
        visible = true;
        continue;
      }
      if (Math.floor(chunk.cropGrowth[k] * 10) !== before) visible = true;
    }
    return visible;
  }

  /** Chunk y tile de una celda global, si está descubierta */
  private tileAt(gx: number, gy: number): { chunk: ChunkData; i: number; j: number } | null {
    const c = this.cellAt(gx, gy);
    return c ? { chunk: c.chunk, i: Math.floor(c.ci / G), j: Math.floor(c.cj / G) } : null;
  }

  /** Primera celda (arriba a la izquierda) de la casilla del cursor que contiene la celda global (gx, gy) */
  private blockAt(gx: number, gy: number): { chunk: ChunkData; ci: number; cj: number } | null {
    const c = this.cellAt(gx, gy);
    if (!c) return null;
    return { chunk: c.chunk, ci: c.ci - (c.ci % BRUSH_CELLS), cj: c.cj - (c.cj % BRUSH_CELLS) };
  }

  private cellAt(gx: number, gy: number): { chunk: ChunkData; ci: number; cj: number } | null {
    const C = WORLD.CELLS;
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    return { chunk: this.world.chunk(cx, cy), ci: gx - cx * C, cj: gy - cy * C };
  }

  /** Siembra la planta en un tile vecino al azar (también de otro chunk descubierto) */
  private seedNeighbour(chunk: ChunkData, i: number, j: number, p: PlantDef): void {
    const [di, dj] = NEIGHBOURS[Math.floor(this.random.next() * 4)];
    let ni = i + di, nj = j + dj, target = chunk;
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) {
      const cx = chunk.cx + Math.floor(ni / N), cy = chunk.cy + Math.floor(nj / N);
      if (!this.world.exploration.isRevealed(cx, cy)) return;
      target = this.world.chunk(cx, cy);
      ni = ((ni % N) + N) % N;
      nj = ((nj % N) + N) % N;
    }
    const t = tileIndex(ni, nj);
    const k = t * PLANT_SLOTS + p.id;
    if (target.plants[k] >= PLANT_MIN) return;
    if (plantCapacity(p, tileContext(target, ni, nj), target.biome[t] as BiomeId) > 0.1) target.plants[k] = PLANT_MIN * 2;
  }

  /** La suma de biomasa × espacio no pasa de 1: si se pasa, ceden primero las pequeñas y luego los arbustos */
  private static limitSpace(chunk: ChunkData, t: number): void {
    const base = t * PLANT_SLOTS;
    let used = 0;
    for (const p of PLANT_DEFS) used += chunk.plants[base + p.id] * PLANT_SPACE[p.kind];
    if (used <= 1) return;
    for (const kind of ['small', 'bush'] as const) {
      let part = 0;
      for (const p of PLANT_DEFS) if (p.kind === kind) part += chunk.plants[base + p.id] * PLANT_SPACE[kind];
      if (part <= 0) continue;
      const scale = Math.max(0, 1 - (used - 1) / part);
      for (const p of PLANT_DEFS) if (p.kind === kind) chunk.plants[base + p.id] *= scale;
      used -= part * (1 - scale);
      if (used <= 1) return;
    }
  }

  /** Firma visible de un tile: décimas de biomasa de cada planta */
  private signature(chunk: ChunkData, base: number): string {
    let s = '';
    for (const p of PLANT_DEFS) s += Math.floor(chunk.plants[base + p.id] * 10);
    return s;
  }
}
