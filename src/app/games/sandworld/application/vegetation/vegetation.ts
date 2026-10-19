import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { PlantDef, VegetationChange } from '../../domain/models/plant.model';
import { BiomeId, TileContext } from '../../domain/models/biome.model';
import { SeasonId } from '../../domain/models/time.model';
import { WORLD } from '../../domain/models/world.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BIOME_BY_ID } from '../../config/biomes.config';
import {
  BURY_KILL, PLANT_DEFS, PLANT_MIN, PLANT_SPACE, SEASON_GROWTH,
} from '../../config/plants.config';
import { World } from '../world/world';
import { tileContext } from '../world/tile-context';
import { invalidateLayout } from './plant-layout';

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

/** Talud extra que dan las raíces de las plantas del tile de esta celda (árboles y sauce) */
export function rootsAt(chunk: ChunkData, k: number): number {
  const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
  const base = tileIndex(Math.floor(ci / G), Math.floor(cj / G)) * PLANT_SLOTS;
  let r = 0;
  for (const p of PLANT_DEFS) if (p.roots) r += p.roots * chunk.plants[base + p.id];
  return r;
}

/**
 * Vegetación por tile. Cada revisión, la biomasa de cada planta se acerca a lo que el tile permite
 * (crece despacio, según su ritmo y la estación; muere más deprisa si las condiciones empeoran),
 * las plantas compiten por el espacio, la enredadera ahoga, las bien crecidas siembran tiles vecinos
 * y la arena que cae de golpe entierra (las pequeñas mueren antes que los árboles).
 */
export class VegetationSystem {
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
      if (visible) {
        invalidateLayout(chunk);
        changed.push({ cx, cy });
      }
    }
    return changed;
  }

  /** Actualiza un tile. Devuelve si alguna planta ha cambiado de forma visible (décimas de biomasa). */
  private updateTile(chunk: ChunkData, i: number, j: number, dt: number, season: SeasonId): boolean {
    const t = tileIndex(i, j);
    const base = t * PLANT_SLOTS;
    const ctx = tileContext(chunk, i, j);
    const biome = chunk.biome[t] as BiomeId;
    const before = this.signature(chunk, base);

    // Arena que entierra o tierra que se va (Duna, Marea, desprendimientos)
    const ground = tileGround(chunk, i, j);
    const change = ground - chunk.vegGround[t];
    if (Math.abs(change) > 0.05) {
      for (const p of PLANT_DEFS) {
        const k = base + p.id;
        chunk.plants[k] *= Math.max(0, 1 - Math.abs(change) / BURY_KILL[p.kind]);
      }
      chunk.vegGround[t] = ground;
    }

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
        if (b > 0.5 && growth > 0 && this.random.next() < p.spread * dt) this.sow(chunk, i, j, p);
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

  /** Siembra la planta en un tile vecino al azar (también de otro chunk descubierto) */
  private sow(chunk: ChunkData, i: number, j: number, p: PlantDef): void {
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
