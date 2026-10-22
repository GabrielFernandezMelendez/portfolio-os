import { ChunkData, PLANT_SLOTS, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Material, MaterialId } from '../../domain/models/material.model';
import { Diet, PlantDef } from '../../domain/models/plant.model';
import { SeasonId, toGameTime } from '../../domain/models/time.model';
import { WORLD } from '../../domain/models/world.model';
import { ChunkCoord } from '../../domain/events/game-events';
import { FaunaWorld, Meal } from '../../domain/ports/fauna-world.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { PLANT_DEFS, PLANT_MIN } from '../../config/plants.config';
import { World } from '../world/world';
import { VegetationSystem } from '../vegetation/vegetation';
import { fruitLevel, invalidateLayout, layoutOf, plantsOf } from '../vegetation/plant-layout';

const C = WORLD.CELLS;
const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
/** Agua (niveles) a partir de la que una celda no se pisa (y cuenta como agua para beber) */
const DEEP = 0.08;
/** Comida que da el fruto de una planta (se lo come entero) y fruto mínimo para que valga la pena */
const FRUIT_FOOD = 0.02;
const FRUIT_RIPE = 0.5;
/**
 * Celdas que no se pisan junto a un borde que da al vacío: el contorno irregular de la isla se come hasta casi
 * una celda (y el animal tiene cuerpo); como los árboles, se quedan a 2 celdas del precipicio.
 */
const EDGE = 2;
/** Biomasa de árboles en un tile para que haga de refugio, y nieve (niveles) que cuenta como nevado */
const SHELTER = 0.3;
const SNOWY = 0.15;
/** Lo que queda de una planta pastada: las raíces (puede rebrotar si no la siguen pisando) */
const GRAZE_FLOOR = PLANT_MIN * 0.4;

/** Comida de pasto u hojas: la que no depende de una temporada de fruto */
const leafy = (p: PlantDef): boolean => !!p.food && !p.food.seasons;
const eats = (p: PlantDef, diets: readonly Diet[]): boolean => !!p.food && p.food.diets.some(d => diets.includes(d));

/**
 * Adaptador del puerto FaunaWorld sobre el mundo real: chunks, vegetación por tile, plantas colocadas (frutos)
 * y fuego. Lo que la fauna cambia en la vegetación se apunta para redibujar esos chunks (takeChanges).
 */
export class FaunaWorldAdapter implements FaunaWorld {
  private readonly changed = new Map<string, ChunkCoord>();

  constructor(private readonly world: World, private readonly vegetation: VegetationSystem) {}

  /** Chunks cuya vegetación ha cambiado por la fauna desde la última llamada (se vacía al leerla) */
  takeChanges(): ChunkCoord[] {
    const out = [...this.changed.values()];
    this.changed.clear();
    return out;
  }

  walkable(gx: number, gy: number): boolean {
    const c = this.cell(gx, gy);
    if (!c) return false;
    const ex = this.world.exploration;
    const { cx, cy } = c.chunk;
    if ((c.ci < EDGE && !ex.isRevealed(cx - 1, cy)) || (c.ci >= C - EDGE && !ex.isRevealed(cx + 1, cy)) ||
        (c.cj < EDGE && !ex.isRevealed(cx, cy - 1)) || (c.cj >= C - EDGE && !ex.isRevealed(cx, cy + 1))) return false;
    return c.chunk.water[c.k] < DEEP && c.chunk.material[c.k] !== Material.CHARRED;
  }

  shelterNear(gx: number, gy: number, max: number): { x: number; y: number } | null {
    const ti = Math.floor(gx / G), tj = Math.floor(gy / G), R = Math.ceil(max / G);
    let best: { x: number; y: number; d: number } | null = null;
    for (let dj = -R; dj <= R; dj++) {
      for (let di = -R; di <= R; di++) {
        const where = this.tile(ti + di, tj + dj);
        if (!where) continue;
        const base = tileIndex(where.i, where.j) * PLANT_SLOTS;
        let trees = 0;
        for (const p of PLANT_DEFS) if (p.kind === 'tree') trees += where.chunk.plants[base + p.id];
        if (trees < SHELTER) continue;
        const x = (ti + di + 0.5) * G, y = (tj + dj + 0.5) * G, d = Math.hypot(x - gx, y - gy);
        if (d <= max && (!best || d < best.d) && this.walkable(Math.floor(x), Math.floor(y))) best = { x, y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  snowAt(gx: number, gy: number): boolean {
    const c = this.cell(gx, gy);
    return !!c && c.chunk.cover[c.k] > SNOWY;
  }

  materialAt(gx: number, gy: number): MaterialId | null {
    const c = this.cell(gx, gy);
    return c ? (c.chunk.material[c.k] as MaterialId) : null;
  }

  flooded(gx: number, gy: number): boolean {
    const c = this.cell(gx, gy);
    return !!c && c.chunk.water[c.k] >= DEEP;
  }

  height(gx: number, gy: number): number {
    const c = this.cell(gx, gy);
    return c ? groundAt(c.chunk, c.k) : 0;
  }

  foodAt(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, now: number, season: SeasonId): number {
    const c = this.cell(gx, gy);
    if (!c) return 0;
    return this.tileFood(c.chunk, Math.floor(c.ci / G), Math.floor(c.cj / G), diets, avoid, now, season);
  }

  eat(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, want: number, favourite: number, now: number, season: SeasonId): Meal | null {
    const c = this.cell(gx, gy);
    if (!c) return null;
    const i = Math.floor(c.ci / G), j = Math.floor(c.cj / G), t = tileIndex(i, j);
    // Fruta madura en el tile (la favorita primero, luego la que más alimenta)
    const fruits = this.fruitsIn(c.chunk, i, j, diets, avoid, now)
      .sort((a, b) => (b.plant === favourite ? 1 : 0) - (a.plant === favourite ? 1 : 0) || PLANT_DEFS[b.plant].food!.nutrition - PLANT_DEFS[a.plant].food!.nutrition);
    // Pasto u hojas
    const leaves = PLANT_DEFS
      .filter(p => leafy(p) && eats(p, diets) && !avoid.has(p.id) && c.chunk.plants[t * PLANT_SLOTS + p.id] > GRAZE_FLOOR + 0.005)
      .sort((a, b) => (b.id === favourite ? 1 : 0) - (a.id === favourite ? 1 : 0) || b.food!.nutrition - a.food!.nutrition);
    const fruit = fruits[0];
    if (fruit && (!leaves.length || leaves[0].id !== favourite)) {
      fruit.eatenAt = now;
      return { food: PLANT_DEFS[fruit.plant].food!.nutrition * FRUIT_FOOD, plant: fruit.plant, fruit: true };
    }
    const p = leaves[0];
    if (!p) return null;
    const slot = t * PLANT_SLOTS + p.id;
    const before = c.chunk.plants[slot];
    const biomass = Math.min(before - GRAZE_FLOOR, want / p.food!.nutrition);
    c.chunk.plants[slot] = before - biomass;
    this.touched(c.chunk, before, c.chunk.plants[slot]);
    return { food: biomass * p.food!.nutrition, plant: p.id, fruit: false };
  }

  nearestWater(gx: number, gy: number, max: number): { x: number; y: number; distance: number } | null {
    for (let r = 0; r <= max; r++) {
      let best: { x: number; y: number; distance: number } | null = null;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = this.cell(gx + dx, gy + dy);
          // Agua para beber: la de un lago, río o charco; en invierno también la nieve y el hielo (se los comen)
          if (!c || (c.chunk.water[c.k] < DEEP && c.chunk.cover[c.k] <= SNOWY)) continue;
          const d = Math.hypot(dx, dy);
          if (!best || d < best.distance) best = { x: gx + dx, y: gy + dy, distance: d };
        }
      }
      if (best) return best;
    }
    return null;
  }

  danger(gx: number, gy: number): { level: number; fromX: number; fromY: number } {
    const ti = Math.floor(gx / G), tj = Math.floor(gy / G);
    let level = 0, fromX = gx, fromY = gy;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const where = this.tile(ti + di, tj + dj);
        if (!where || where.chunk.fire[tileIndex(where.i, where.j)] <= 0) continue;
        const l = di === 0 && dj === 0 ? 1 : 0.5;
        if (l > level) {
          level = l;
          fromX = (ti + di + 0.5) * G;
          fromY = (tj + dj + 0.5) * G;
        }
      }
    }
    return { level, fromX, fromY };
  }

  trample(gx: number, gy: number, amount: number): void {
    const where = this.tile(Math.floor(gx / G), Math.floor(gy / G));
    if (!where || amount <= 0) return;
    const base = tileIndex(where.i, where.j) * PLANT_SLOTS;
    for (const p of PLANT_DEFS) {
      if (p.kind !== 'small') continue;
      const before = where.chunk.plants[base + p.id];
      if (before <= 0) continue;
      where.chunk.plants[base + p.id] = before * (1 - amount);
      this.touched(where.chunk, before, where.chunk.plants[base + p.id]);
    }
  }

  dropSeed(plant: number, gx: number, gy: number): void {
    if (this.vegetation.germinate(plant, gx, gy)) {
      const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
      this.changed.set(`${cx},${cy}`, { cx, cy });
    }
  }

  fertilize(gx: number, gy: number, amount: number): void {
    const where = this.tile(Math.floor(gx / G), Math.floor(gy / G));
    if (!where) return;
    const t = tileIndex(where.i, where.j);
    where.chunk.fertility[t] = Math.max(0, Math.min(1, where.chunk.fertility[t] + amount));
  }

  totalFood(diets: readonly Diet[], now: number, season: SeasonId): number {
    let sum = 0;
    for (const { cx, cy } of this.world.exploration.list()) {
      const chunk = this.world.chunk(cx, cy);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) sum += this.tileFood(chunk, i, j, diets, EMPTY, now, season);
    }
    return sum;
  }

  islandChunks(): number {
    return this.world.exploration.list().length;
  }

  /**
   * Una celda pisable junto a la orilla: elige al azar un chunk con un lado que da al vacío, un punto de ese lado y
   * entra hacia dentro hasta encontrar suelo pisable (el borde mismo no se pisa).
   */
  shore(random: RandomSource): { x: number; y: number } | null {
    const ex = this.world.exploration;
    const sides: { cx: number; cy: number; dx: number; dy: number }[] = [];
    for (const { cx, cy } of ex.list()) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!ex.isRevealed(cx + dx, cy + dy)) sides.push({ cx, cy, dx, dy });
    }
    for (let n = 0; n < 20 && sides.length; n++) {
      const side = sides[Math.floor(random.next() * sides.length)];
      const along = Math.floor(random.next() * C);
      for (let depth = EDGE; depth < EDGE + 10; depth++) {
        // Desde el lado que da al vacío hacia el centro del chunk
        const ci = side.dx === 1 ? C - 1 - depth : side.dx === -1 ? depth : along;
        const cj = side.dy === 1 ? C - 1 - depth : side.dy === -1 ? depth : along;
        const gx = side.cx * C + ci, gy = side.cy * C + cj;
        if (this.walkable(gx, gy)) return { x: gx + 0.5, y: gy + 0.5 };
      }
    }
    return null;
  }

  // ── Utilidades ──

  private tileFood(chunk: ChunkData, i: number, j: number, diets: readonly Diet[], avoid: ReadonlySet<number>, now: number, _season: SeasonId): number {
    const base = tileIndex(i, j) * PLANT_SLOTS;
    let food = 0;
    for (const p of PLANT_DEFS) {
      if (!leafy(p) || !eats(p, diets) || avoid.has(p.id)) continue;
      food += Math.max(0, chunk.plants[base + p.id] - GRAZE_FLOOR) * p.food!.nutrition;
    }
    for (const f of this.fruitsIn(chunk, i, j, diets, avoid, now)) food += PLANT_DEFS[f.plant].food!.nutrition * FRUIT_FOOD;
    return food;
  }

  /** Plantas del tile con fruta madura que puede comer */
  private fruitsIn(chunk: ChunkData, i: number, j: number, diets: readonly Diet[], avoid: ReadonlySet<number>, now: number) {
    const revealed = (cx: number, cy: number) => this.world.exploration.isRevealed(cx, cy);
    const list = plantsOf(chunk).length ? plantsOf(chunk) : layoutOf(chunk, revealed, now);
    const time = toGameTime(now);
    return list.filter(inst => {
      if (Math.floor(inst.ci / G) !== i || Math.floor(inst.cj / G) !== j || avoid.has(inst.plant)) return false;
      const p = PLANT_DEFS[inst.plant];
      return !leafy(p) && eats(p, diets) && fruitLevel(inst, time) >= FRUIT_RIPE;
    });
  }

  /** Si la planta ha cambiado de forma visible (décimas), hay que recolocar las plantas del chunk */
  private touched(chunk: ChunkData, before: number, after: number): void {
    if (Math.floor(before * 10) === Math.floor(after * 10)) return;
    invalidateLayout(chunk);
    this.changed.set(`${chunk.cx},${chunk.cy}`, { cx: chunk.cx, cy: chunk.cy });
  }

  private cell(gx: number, gy: number): { chunk: ChunkData; k: number; ci: number; cj: number } | null {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    const ci = gx - cx * C, cj = gy - cy * C;
    return { chunk: this.world.chunk(cx, cy), k: cellIndex(ci, cj), ci, cj };
  }

  /** Chunk y tile local de un tile global (si está descubierto) */
  private tile(ti: number, tj: number): { chunk: ChunkData; i: number; j: number } | null {
    const cx = Math.floor(ti / N), cy = Math.floor(tj / N);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    return { chunk: this.world.chunk(cx, cy), i: ti - cx * N, j: tj - cy * N };
  }
}

const EMPTY: ReadonlySet<number> = new Set();
