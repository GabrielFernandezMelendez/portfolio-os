import { ChunkData, PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { Material, MaterialId } from '../../domain/models/material.model';
import { SeasonId } from '../../domain/models/time.model';
import { WORLD } from '../../domain/models/world.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { MATERIAL_DEFS } from '../../config/materials.config';
import { PLANT_DEFS } from '../../config/plants.config';
import {
  ASH_FERTILITY, BURNED_MEMORY_DAYS, BURNT_FEED_BOOST, BURNT_FEED_DAYS, BURNT_FEED_PER_UNIT, BURNT_FROZEN_SHIFT,
  BURNT_LAND_TILES, BURNT_SPREAD_PER_DAY, BURN_DAYS, DROUGHT_DRYNESS, DROUGHT_FULL_DAYS, FIRE_STOP_COVER, FROZEN_DAYS_PER_UNIT,
  FROZEN_MAX_DAYS, IGNITE_MIN,
  LIGHTNING_CANDIDATES, RAIN_DOUSE_PER_DAY, RAIN_DRYNESS, REMIT_FERTILITY, REMIT_GRASS, REMIT_JITTER_DAYS, REMIT_RING_DAYS,
  REMIT_START_DAYS, SCORCH_DAYS, SEASON_DRYNESS, SPREAD_FROM_AGE, SPREAD_PER_DAY,
} from '../../config/fire.config';
import { World } from '../world/world';

const N = WORLD.TILES;
const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
/** Vecinas de un tile (E, O, S, N): el fuego solo salta por los lados, así una zanja recta lo para */
const SIDES: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const WET = 0.05;
/** Parte del tile que arde a la vez detrás del frente (lo de antes ya es ceniza) */
export const BURNING_BAND = 0.35;

/** Qué prendió un fuego */
export type FireCause = 'lightning' | 'brasa' | 'dev' | 'spread';

/** Lo que el fuego tiene que contar (crónica) o enseñar (el rayo) */
export type FireNews =
  | { readonly type: 'ignite'; readonly cause: FireCause; readonly gi: number; readonly gj: number }
  | { readonly type: 'strike'; readonly gx: number; readonly gy: number; readonly ignited: boolean }
  | { readonly type: 'out' }
  | { readonly type: 'burntLand'; readonly gi: number; readonly gj: number }
  | { readonly type: 'remit'; readonly gi: number; readonly gj: number };

/** Lo que el fuego necesita saber del tiempo (lo pone quien lleva el reloj y el tiempo atmosférico) */
export interface FireConditions {
  season: SeasonId;
  /** Días sin que nada rompa la sequía */
  droughtDays: number;
  /** Lluvia ahora (0 = no llueve, hasta 1) */
  rain: number;
}

interface TileRef {
  readonly chunk: ChunkData;
  readonly i: number;
  readonly j: number;
  readonly t: number;
}

/**
 * Fuego y Tierra Quemada. Todo va por tile (un tile = 4×4 celdas):
 * - Sequedad: humedad del suelo y del clima, agua, estación, sequía y lluvia.
 * - Combustible: la biomasa de sus plantas por su `fuel` (registro de plantas) más el del suelo (humus, turba).
 * - Prende si combustible × sequedad pasa de IGNITE_MIN: por un rayo, por la Brasa o por una vecina en llamas.
 * - Arde con un frente que cruza el tile desde por donde entró: quema las plantas, chamusca el suelo (motas de
 *   ceniza que abonan) y, a partir de cierto avance, salta a las vecinas por los lados. Lo frenan el agua, la nieve
 *   o el hielo (Escarcha), la falta de combustible (roca, arena, una zanja de Marea) y la lluvia, que lo apaga.
 * - Si arden juntos BURNT_LAND_TILES tiles, nace la Tierra Quemada: suelo calcinado, sin agua (la evapora), con
 *   "vida" (sus criaturas hasta que llegue la fauna) que la mantiene y la hace crecer despacio por sus bordes.
 *   Se contiene igual que el fuego. Sin vida, remite de fuera hacia dentro y vuelve a ser tierra fértil.
 */
export class FireSystem {
  readonly conditions: FireConditions = { season: 0, droughtDays: 0, rain: 0 };
  readonly news: FireNews[] = [];
  /** Reloj propio (minutos): sirve para saber qué tiles ardieron hace poco */
  private now = 0;

  constructor(
    private readonly world: World,
    private readonly random: RandomSource,
  ) {}

  // ── Consultas ──

  /** Sequedad del tile (0 = empapado, 1 = yesca) */
  dryness(chunk: ChunkData, i: number, j: number): number {
    const t = tileIndex(i, j);
    let moisture = 0, wet = 0;
    for (let dj = 0; dj < G; dj++) {
      for (let di = 0; di < G; di++) {
        const k = cellIndex(i * G + di, j * G + dj);
        moisture += chunk.moisture[k];
        if (chunk.water[k] > WET) wet++;
      }
    }
    moisture /= G * G;
    wet /= G * G;
    const { season, droughtDays, rain } = this.conditions;
    // Lo mojado no arde; la estación y la sequía solo cambian cuánto arde lo que ya está seco
    let d = 1 - Math.max(moisture, chunk.humidity[t] * 0.7, wet * 2);
    let factor = 1 + SEASON_DRYNESS[season];
    if (season === 1) factor += DROUGHT_DRYNESS * Math.min(1, droughtDays / DROUGHT_FULL_DAYS);
    d *= factor;
    if (rain > 0) d *= RAIN_DRYNESS;
    return Math.max(0, Math.min(1, d));
  }

  /** Combustible del tile (0..1): plantas y suelo */
  fuel(chunk: ChunkData, i: number, j: number): number {
    const base = tileIndex(i, j) * PLANT_SLOTS;
    let f = 0;
    for (const p of PLANT_DEFS) f += chunk.plants[base + p.id] * p.fuel;
    let ground = 0, bare = 0;
    for (let dj = 0; dj < G; dj++) {
      for (let di = 0; di < G; di++) {
        const k = cellIndex(i * G + di, j * G + dj);
        if (chunk.sediment[k] > 0.05) ground += MATERIAL_DEFS[chunk.material[k] as MaterialId].fuel;
        else bare++;
      }
    }
    // Donde la roca está desnuda (una zanja de Marea) no hay nada que arda, tenga el tile la hierba que tenga
    return Math.min(1, f * (1 - bare / (G * G)) + (ground / (G * G)) * 0.5);
  }

  /** ¿Es Tierra Quemada el tile de esta celda global? */
  isBurntLandAt(gx: number, gy: number): boolean {
    const r = this.tileOfCell(gx, gy);
    return !!r && isBurnt(r.chunk, r.i, r.j);
  }

  // ── Acciones ──

  /** Intenta prender el tile de la celda global (gx, gy). `force` = sin mirar si está seco (modo desarrollo). */
  igniteAtCell(gx: number, gy: number, cause: FireCause, force = false): boolean {
    const r = this.tileOfCell(gx, gy);
    return !!r && this.ignite(r, cause, 0, force);
  }

  /**
   * Escarcha: apaga el fuego y deja el tile helado unos días (muro de Escarcha): no prende y, si es Tierra Quemada,
   * no crece desde él. `amount` = arena vertida en la celda en este paso.
   */
  douseAtCell(gx: number, gy: number, amount = 1): void {
    const r = this.tileOfCell(gx, gy);
    if (!r) return;
    if (r.chunk.fire[r.t] > 0) this.extinguish(r);
    r.chunk.frozen[r.t] = Math.min(FROZEN_MAX_DAYS, r.chunk.frozen[r.t] + amount * FROZEN_DAYS_PER_UNIT);
  }

  /** Humus o Brasa: avivan un fuego y alimentan la Tierra Quemada (crece más deprisa unos días) */
  feedAtCell(gx: number, gy: number, amount: number): void {
    const r = this.tileOfCell(gx, gy);
    if (!r) return;
    const c = r.chunk;
    if (c.fire[r.t] > 0) c.fire[r.t] = Math.min(1, c.fire[r.t] + amount);
    if (isBurnt(c, r.i, r.j)) c.feed[r.t] = Math.min(1, c.feed[r.t] + amount * BURNT_FEED_PER_UNIT);
  }

  /** Tormenta: con esta probabilidad cae un rayo este minuto; prefiere árboles altos y tiles secos */
  strike(chance: number): void {
    if (this.random.next() >= chance) return;
    const chunks = this.world.exploration.list();
    if (!chunks.length) return;
    let best: TileRef | null = null, bestScore = -1;
    for (let n = 0; n < LIGHTNING_CANDIDATES; n++) {
      const { cx, cy } = chunks[Math.floor(this.random.next() * chunks.length)];
      const chunk = this.world.chunk(cx, cy);
      const i = Math.floor(this.random.next() * N), j = Math.floor(this.random.next() * N);
      const t = tileIndex(i, j);
      let trees = 0;
      for (const p of PLANT_DEFS) if (p.kind === 'tree') trees += chunk.plants[t * PLANT_SLOTS + p.id];
      const score = Math.min(1, trees) * 2 + this.dryness(chunk, i, j) + this.random.next() * 0.3;
      if (score > bestScore) { bestScore = score; best = { chunk, i, j, t }; }
    }
    if (!best) return;
    const gx = best.chunk.cx * C + best.i * G + 1 + Math.floor(this.random.next() * 2);
    const gy = best.chunk.cy * C + best.j * G + 1 + Math.floor(this.random.next() * 2);
    const ignited = this.ignite(best, 'lightning', 0);
    this.news.push({ type: 'strike', gx, gy, ignited });
  }

  /** TEMPORAL (modo desarrollo): Tierra Quemada de 3 × 3 tiles con la esquina en el tile global (gi, gj) */
  makeBurntLand(gi: number, gj: number): void {
    const tiles: TileRef[] = [];
    for (let dj = 0; dj < 3; dj++) for (let di = 0; di < 3; di++) {
      const r = this.tile(gi + di, gj + dj);
      if (r) tiles.push(r);
    }
    this.toBurntLand(tiles);
  }

  /** TEMPORAL (modo desarrollo): la Tierra Quemada se queda sin vida (empieza a remitir). Devuelve cuántos tiles. */
  drainLife(): number {
    let n = 0;
    this.forEachTile(r => {
      if (r.chunk.life[r.t] > 0) { r.chunk.life[r.t] = 0; n++; }
    });
    return n;
  }

  /** ¿Hay algo ardiendo? (para no recorrer nada si no) */
  get burning(): boolean {
    let any = false;
    this.forEachTile(r => { if (r.chunk.fire[r.t] > 0) any = true; });
    return any;
  }

  // ── Paso del tiempo ──

  /** Avanza `minutes` minutos de juego. Añade a `changed` los chunks cuyo aspecto ha cambiado. */
  update(minutes: number, changed: Set<string>): void {
    this.now += minutes;
    const dt = minutes / 1440;
    const burning: TileRef[] = [];
    const burnt: TileRef[] = [];
    this.forEachTile(r => {
      if (r.chunk.frozen[r.t] > 0) r.chunk.frozen[r.t] = Math.max(0, r.chunk.frozen[r.t] - dt);
      if (r.chunk.fire[r.t] > 0) burning.push(r);
      if (isBurnt(r.chunk, r.i, r.j)) burnt.push(r);
    });
    for (const r of burning) this.burn(r, dt, changed);
    for (const r of burnt) this.burntLand(r, dt, changed);
    this.fadeScorch(dt, changed);
  }

  // ── Arder ──

  private ignite(r: TileRef, cause: FireCause, from: number, force = false): boolean {
    const c = r.chunk;
    if (c.fire[r.t] > 0 || isBurnt(c, r.i, r.j) || c.frozen[r.t] > 0) return false;
    if (this.coverOf(c, r.i, r.j) > FIRE_STOP_COVER) return false;
    const fuel = this.fuel(c, r.i, r.j);
    const dry = this.dryness(c, r.i, r.j);
    if (!force && fuel * dry < IGNITE_MIN) return false;
    if (fuel <= 0.02) return false;
    c.fire[r.t] = Math.max(0.3, Math.min(1, fuel * (force ? 1 : dry) * 2));
    c.fireAge[r.t] = 0;
    c.fireFrom[r.t] = from;
    if (cause !== 'spread') this.news.push({ type: 'ignite', cause, gi: c.cx * N + r.i, gj: c.cy * N + r.j });
    return true;
  }

  private burn(r: TileRef, dt: number, changed: Set<string>): void {
    const c = r.chunk;
    // La lluvia lo apaga poco a poco; la nieve o el hielo (Escarcha) de golpe
    if (this.conditions.rain > 0) c.fire[r.t] -= RAIN_DOUSE_PER_DAY * this.conditions.rain * dt;
    if (c.fire[r.t] <= 0 || this.coverOf(c, r.i, r.j) > FIRE_STOP_COVER) {
      this.extinguish(r);
      this.news.push({ type: 'out' });
      changed.add(`${c.cx},${c.cy}`);
      return;
    }
    const fuel = this.fuel(c, r.i, r.j);
    c.fireAge[r.t] = Math.min(1, c.fireAge[r.t] + dt / (BURN_DAYS * (0.6 + fuel)));
    // Las plantas arden cuando el frente llega a su celda (el suelo chamuscado las mata en su sitio);
    // al terminar, lo que quede de biomasa en el tile se ha quemado
    // El suelo que ya ha cruzado el frente queda chamuscado (y seco)
    // (con un poco de retraso: lo que está justo en el frente aún arde, plantas incluidas)
    const done = c.fireAge[r.t] >= 1 ? G * G : Math.floor((c.fireAge[r.t] - BURNING_BAND) * G * G);
    for (const k of frontOrder(r.i, r.j, c.fireFrom[r.t]).slice(0, Math.max(0, done))) {
      if (c.scorch[k] < 1) { c.scorch[k] = 1; c.moisture[k] = 0; }
    }
    changed.add(`${c.cx},${c.cy}`);
    // Salta a las vecinas por los lados (el borde que avanza de la Tierra Quemada no: arde sin propagarse)
    if (c.fireAge[r.t] >= SPREAD_FROM_AGE && c.fireFrom[r.t] <= CREEP) {
      SIDES.forEach(([di, dj], d) => {
        const n = this.tile(c.cx * N + r.i + di, c.cy * N + r.j + dj);
        if (!n || n.chunk.fire[n.t] > 0 || this.recentlyBurned(n)) return;
        const pressure = SPREAD_PER_DAY * c.fire[r.t] * this.fuel(n.chunk, n.i, n.j) * this.dryness(n.chunk, n.i, n.j);
        if (this.random.next() < 1 - Math.exp(-pressure * dt)) this.ignite(n, 'spread', opposite(d) + 1);
      });
    }
    if (c.fireAge[r.t] >= 1) this.finish(r, changed);
  }

  private finish(r: TileRef, changed: Set<string>): void {
    const c = r.chunk;
    c.fire[r.t] = 0;
    c.fireAge[r.t] = 0;
    c.burnedAt[r.t] = this.now;
    c.fertility[r.t] = Math.min(1, c.fertility[r.t] + ASH_FERTILITY);
    for (const p of PLANT_DEFS) if (p.fuel > 0) c.plants[r.t * PLANT_SLOTS + p.id] = 0;
    // ¿Se ha juntado una zona quemada lo bastante grande, o toca Tierra Quemada? Entonces lo es.
    const cluster = this.burnedCluster(r);
    const touchesBurnt = cluster.some(q => SIDES.some(([di, dj]) => {
      const n = this.tile(q.chunk.cx * N + q.i + di, q.chunk.cy * N + q.j + dj);
      return !!n && isBurnt(n.chunk, n.i, n.j);
    }));
    if (cluster.length >= BURNT_LAND_TILES || touchesBurnt) {
      this.toBurntLand(cluster);
      for (const q of cluster) changed.add(`${q.chunk.cx},${q.chunk.cy}`);
    }
  }

  private extinguish(r: TileRef): void {
    r.chunk.fire[r.t] = 0;
    r.chunk.fireAge[r.t] = 0;
  }

  /** Tiles quemados hace poco y unidos (por los lados) a este */
  private burnedCluster(start: TileRef): TileRef[] {
    const seen = new Set<string>();
    const out: TileRef[] = [];
    const stack = [start];
    while (stack.length && out.length < 64) {
      const r = stack.pop()!;
      const key = `${r.chunk.cx * N + r.i},${r.chunk.cy * N + r.j}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!this.recentlyBurned(r) || isBurnt(r.chunk, r.i, r.j)) continue;
      out.push(r);
      for (const [di, dj] of SIDES) {
        const n = this.tile(r.chunk.cx * N + r.i + di, r.chunk.cy * N + r.j + dj);
        if (n) stack.push(n);
      }
    }
    return out;
  }

  private recentlyBurned(r: TileRef): boolean {
    const at = r.chunk.burnedAt[r.t];
    return at >= 0 && this.now - at <= BURNED_MEMORY_DAYS * 1440;
  }

  // ── Tierra Quemada ──

  /** Convierte estos tiles en Tierra Quemada: suelo calcinado (con borde irregular), sin plantas, con vida */
  private toBurntLand(tiles: readonly TileRef[]): void {
    const inSet = new Set(tiles.map(r => `${r.chunk.cx * N + r.i},${r.chunk.cy * N + r.j}`));
    for (const r of tiles) {
      const c = r.chunk;
      c.burnt[r.t] = 1;
      c.life[r.t] = 1;
      c.remit[r.t] = 0;
      c.fire[r.t] = 0;
      c.fireAge[r.t] = 0;
      for (const p of PLANT_DEFS) c.plants[r.t * PLANT_SLOTS + p.id] = 0;
      for (let dj = 0; dj < G; dj++) {
        for (let di = 0; di < G; di++) {
          const ci = r.i * G + di, cj = r.j * G + dj;
          const k = cellIndex(ci, cj);
          if (c.sediment[k] <= 0.05) continue;
          // Borde irregular: en el lado que da a tierra viva, algunas celdas solo quedan chamuscadas
          const gi = c.cx * N + r.i, gj = c.cy * N + r.j;
          const edge = (di === 0 && !inSet.has(`${gi - 1},${gj}`)) || (di === G - 1 && !inSet.has(`${gi + 1},${gj}`)) ||
                       (dj === 0 && !inSet.has(`${gi},${gj - 1}`)) || (dj === G - 1 && !inSet.has(`${gi},${gj + 1}`));
          c.scorch[k] = 1;
          c.moisture[k] = 0;
          c.water[k] = 0;
          if (edge && cellHash(c.cx * C + ci, c.cy * C + cj) < 0.4) continue;
          c.material[k] = Material.CHARRED;
        }
      }
    }
    if (tiles.length) {
      const r = tiles[Math.floor(tiles.length / 2)];
      this.news.push({ type: 'burntLand', gi: r.chunk.cx * N + r.i, gj: r.chunk.cy * N + r.j });
    }
  }

  /** Un tile de Tierra Quemada: evapora el agua, crece por sus bordes y, sin vida, remite */
  private burntLand(r: TileRef, dt: number, changed: Set<string>): void {
    const c = r.chunk;
    // El suelo quema el agua: no hay lagos ni charcos (ni con lluvia, ni con un río, ni en una zanja)
    for (let dj = 0; dj < G; dj++) {
      for (let di = 0; di < G; di++) {
        const k = cellIndex(r.i * G + di, r.j * G + dj);
        if (c.water[k] > 0 || c.moisture[k] > 0) { c.water[k] = 0; c.moisture[k] = 0; }
      }
    }
    c.feed[r.t] = Math.max(0, c.feed[r.t] - dt / BURNT_FEED_DAYS);
    if (c.life[r.t] > 0) {
      this.spreadBurntLand(r, dt);
      return;
    }
    // Sin vida: cuenta atrás según lo lejos que está del borde (de fuera hacia dentro)
    if (c.remit[r.t] === 0) {
      c.remit[r.t] = -(REMIT_START_DAYS + this.depthOf(r) * REMIT_RING_DAYS + this.random.next() * REMIT_JITTER_DAYS);
    }
    c.remit[r.t] += dt;
    if (c.remit[r.t] >= 0) {
      this.revive(r);
      changed.add(`${c.cx},${c.cy}`);
    }
  }

  private spreadBurntLand(r: TileRef, dt: number): void {
    const c = r.chunk;
    // Un borde helado (Escarcha) no crece mientras dure el frío
    if (c.frozen[r.t] > 0 || this.coverOf(c, r.i, r.j) > FIRE_STOP_COVER || c.tempShift[r.t] < BURNT_FROZEN_SHIFT) return;
    const rate = BURNT_SPREAD_PER_DAY[this.conditions.season] * (1 + c.feed[r.t] * BURNT_FEED_BOOST);
    for (const [di, dj] of SIDES) {
      const n = this.tile(c.cx * N + r.i + di, c.cy * N + r.j + dj);
      if (!n || isBurnt(n.chunk, n.i, n.j) || n.chunk.fire[n.t] > 0) continue;
      const dry = this.dryness(n.chunk, n.i, n.j);
      if (this.random.next() < 1 - Math.exp(-rate * dry * dt)) {
        // Prende el borde vecino: arde y, al terminar, como toca Tierra Quemada, pasa a serlo
        const d = SIDES.findIndex(([x, y]) => x === -di && y === -dj);
        this.ignite(n, 'spread', d + 1 + CREEP);
      }
    }
  }

  /** Anillo del tile dentro de su Tierra Quemada: 0 = en el borde */
  private depthOf(r: TileRef): number {
    for (let d = 1; d < 8; d++) {
      for (let dj = -d; dj <= d; dj++) {
        for (let di = -d; di <= d; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== d) continue;
          const n = this.tile(r.chunk.cx * N + r.i + di, r.chunk.cy * N + r.j + dj);
          if (!n || !isBurnt(n.chunk, n.i, n.j)) return d - 1;
        }
      }
    }
    return 7;
  }

  /** Vuelve a ser tierra viva: ceniza fértil donde estaba calcinado y algo de hierba para empezar */
  private revive(r: TileRef): void {
    const c = r.chunk;
    c.burnt[r.t] = 0;
    c.remit[r.t] = 0;
    c.life[r.t] = 0;
    c.feed[r.t] = 0;
    c.burnedAt[r.t] = -1;
    for (let dj = 0; dj < G; dj++) {
      for (let di = 0; di < G; di++) {
        const k = cellIndex(r.i * G + di, r.j * G + dj);
        if (c.material[k] === Material.CHARRED) c.material[k] = Material.SOIL;
        c.scorch[k] = 1;
        c.moisture[k] = 0.4;
      }
    }
    c.fertility[r.t] = Math.min(1, c.fertility[r.t] + REMIT_FERTILITY);
    const grass = PLANT_DEFS.find(p => p.key === 'grass');
    if (grass) c.plants[r.t * PLANT_SLOTS + grass.id] = Math.max(c.plants[r.t * PLANT_SLOTS + grass.id], REMIT_GRASS);
    this.news.push({ type: 'remit', gi: c.cx * N + r.i, gj: c.cy * N + r.j });
  }

  // ── Ceniza ──

  private fadeScorch(dt: number, changed: Set<string>): void {
    for (const { cx, cy } of this.world.exploration.list()) {
      const c = this.world.chunk(cx, cy);
      let visible = false;
      for (let k = 0; k < c.scorch.length; k++) {
        const s = c.scorch[k];
        if (s <= 0 || c.material[k] === Material.CHARRED) continue;
        const next = Math.max(0, s - dt / SCORCH_DAYS);
        if (Math.floor(next * 6) !== Math.floor(s * 6)) visible = true;
        c.scorch[k] = next;
      }
      if (visible) changed.add(`${cx},${cy}`);
    }
  }

  // ── Utilidades ──

  private forEachTile(fn: (r: TileRef) => void): void {
    for (const { cx, cy } of this.world.exploration.list()) {
      const chunk = this.world.chunk(cx, cy);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) fn({ chunk, i, j, t: tileIndex(i, j) });
    }
  }

  /** Tile por coordenadas globales de tile (null si está bajo las nubes) */
  private tile(gi: number, gj: number): TileRef | null {
    const cx = Math.floor(gi / N), cy = Math.floor(gj / N);
    if (!this.world.exploration.isRevealed(cx, cy)) return null;
    const i = gi - cx * N, j = gj - cy * N;
    return { chunk: this.world.chunk(cx, cy), i, j, t: tileIndex(i, j) };
  }

  private tileOfCell(gx: number, gy: number): TileRef | null {
    return this.tile(Math.floor(gx / G), Math.floor(gy / G));
  }

  /** Nieve o hielo de media en el tile */
  private coverOf(c: ChunkData, i: number, j: number): number {
    let s = 0;
    for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) s += c.cover[cellIndex(i * G + di, j * G + dj)];
    return s / (G * G);
  }
}

/** ¿Es Tierra Quemada? */
export function isBurnt(c: ChunkData, i: number, j: number): boolean {
  return c.burnt[tileIndex(i, j)] === 1;
}

/**
 * Orden en el que el frente cruza las 16 celdas del tile: desde el centro (rayo, Brasa) o desde el lado por el
 * que entró, con un poco de azar fijo para que no sea una línea recta. Lo usa también el dibujo.
 */
export function frontOrder(i: number, j: number, from: number): number[] {
  const cells: [number, number][] = [];
  if (from > CREEP) from -= CREEP;
  for (let dj = 0; dj < G; dj++) {
    for (let di = 0; di < G; di++) {
      const x = di + 0.5, y = dj + 0.5;
      let d: number;
      switch (from) {
        case 1: d = G - x; break;        // entró por el este
        case 2: d = x; break;            // por el oeste
        case 3: d = G - y; break;        // por el sur
        case 4: d = y; break;            // por el norte
        default: d = Math.hypot(x - G / 2, y - G / 2);
      }
      cells.push([d + cellHash(i * G + di, j * G + dj) * 1.2, cellIndex(i * G + di, j * G + dj)]);
    }
  }
  return cells.sort((a, b) => a[0] - b[0]).map(c => c[1]);
}

/** Se suma a fireFrom cuando arde el borde que avanza de la Tierra Quemada */
const CREEP = 4;

/** Lado contrario (E↔O, S↔N) en el orden de SIDES */
const opposite = (d: number): number => [1, 0, 3, 2][d];

function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
