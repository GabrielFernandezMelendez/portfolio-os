import { BurntLand, BurntRegion } from '../../domain/ports/burnt-land.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { SpeciesDef } from '../../domain/models/species.model';
import { Sex } from '../../domain/models/animal.model';
import { WORLD } from '../../domain/models/world.model';
import { SPECIES_DEFS } from '../../config/species.config';
import { FaunaSystem } from './fauna-system';

const G = WORLD.CELLS_PER_TILE;
const DAY = 1440;
/** Vecinos de un tile (los cuatro lados) */
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Lo que se sabe de cada zona de Tierra Quemada: cuándo nacen sus criaturas y si ya nacieron */
interface Record {
  readonly spawnAt: number;
  spawned: boolean;
  tiles: Set<string>;
}

/**
 * Criaturas que nacen con la Tierra Quemada (los goblins), común a cualquier especie con `burntBorn`.
 * Cada hora: mira las zonas de Tierra Quemada; a una zona nueva le apunta cuándo nacerán sus criaturas (tirada
 * de días); llegado el momento, aparecen sus nidos (uno o dos según su tamaño, como mucho `maxNests` en la isla).
 * La vida de la zona es la de sus criaturas: mientras quede una viva (en su nido, dentro o cazando cerca), la zona
 * vive y crece; cuando no queda ninguna, remite. Antes de que nazcan, la zona también vive.
 */
export class BurntBorn {
  private records: Record[] = [];

  constructor(private readonly land: BurntLand, private readonly fauna: FaunaSystem, private readonly random: RandomSource) {}

  /** Una hora. Devuelve cuántos nidos han nacido (para la crónica) */
  hour(now: number): { species: number; nests: number }[] {
    const species = SPECIES_DEFS.filter(s => s.burntBorn);
    if (!species.length) return [];
    const regions = this.land.regions();
    const out: { species: number; nests: number }[] = [];
    // Tiles de cada zona apuntada (si una zona se parte al remitir, sus trozos siguen siendo la misma zona)
    const next = new Map<Record, Set<string>>();
    const homes = this.homesByRegion(regions, species);
    regions.forEach((region, i) => {
      const keys = region.tiles.map(t => `${t.gi},${t.gj}`);
      // La zona de antes (comparte algún tile): si se juntaron varias, la que ya tenía sus criaturas
      const old = this.records.filter(r => keys.some(k => r.tiles.has(k)));
      let rec = old.find(r => r.spawned) ?? old[0];
      if (!rec) {
        const s = species[0];
        const [lo, hi] = s.burntBorn!.delayDays;
        rec = { spawnAt: now + (lo + this.random.next() * (hi - lo)) * DAY, spawned: false, tiles: new Set() };
      }
      const tiles = next.get(rec) ?? new Set<string>();
      for (const k of keys) tiles.add(k);
      next.set(rec, tiles);
      if (!rec.spawned && now >= rec.spawnAt) {
        rec.spawned = true;
        for (const s of species) out.push({ species: s.id, nests: this.spawn(s, region, now) });
        homes[i] = true;
      }
      this.land.setLife(region, !rec.spawned || homes[i]);
    });
    for (const [rec, tiles] of next) rec.tiles = tiles;
    this.records = [...next.keys()];
    return out;
  }

  /**
   * Nidos de una zona: uno, o dos si es grande (`tilesPerNest`), sin pasar del tope de la isla (`maxNests`, sumando
   * los que ya hay), en tiles al azar. Cada uno con su tirada de criaturas, más cuanto más grande es la zona.
   */
  private spawn(s: SpeciesDef, region: BurntRegion, now: number): number {
    const b = s.burntBorn!;
    const size = region.tiles.length;
    let have = 0;
    for (const h of this.fauna.herds.values()) if (h.species === s.id && this.fauna.members(h.id).length > 0) have++;
    const nests = Math.min(size < b.tilesPerNest ? 1 : 2, Math.max(0, b.maxNests - have));
    let made = 0;
    const spots = this.heart(region, nests);
    for (let n = 0; n < nests; n++) {
      const t = spots[n];
      const roll = b.perNest[0] + Math.floor(this.random.next() * (b.perNest[1] - b.perNest[0] + 1));
      const count = Math.min(b.perNestMax, roll + Math.floor(size / b.extraPerTiles));
      const founders: { sex: Sex; age: 'adult' }[] = [];
      for (let k = 0; k < count; k++) founders.push({ sex: this.random.next() < 0.5 ? 'female' : 'male', age: 'adult' });
      const out = this.fauna.spawnHerd(s.key, t.gi * G + 2, t.gj * G + 2, now, true, founders);
      if (out.length) made++;
    }
    return made;
  }

  /**
   * Dónde van los nidos: en el corazón de la zona, los tiles más lejos de su borde (por donde se contiene con
   * Escarcha); el segundo nido, lo más lejos posible del primero entre los más hondos. Empates, al azar.
   */
  private heart(region: BurntRegion, n: number): { gi: number; gj: number }[] {
    const keys = new Set(region.tiles.map(t => `${t.gi},${t.gj}`));
    const depth = new Map<string, number>();
    let ring = region.tiles.filter(t => SIDES.some(([di, dj]) => !keys.has(`${t.gi + di},${t.gj + dj}`)));
    for (let d = 0; ring.length; d++) {
      for (const t of ring) depth.set(`${t.gi},${t.gj}`, d);
      const next = new Map<string, { gi: number; gj: number }>();
      for (const t of ring) for (const [di, dj] of SIDES) {
        const k = `${t.gi + di},${t.gj + dj}`;
        if (keys.has(k) && !depth.has(k)) next.set(k, { gi: t.gi + di, gj: t.gj + dj });
      }
      ring = [...next.values()];
    }
    const deep = (t: { gi: number; gj: number }) => depth.get(`${t.gi},${t.gj}`) ?? 0;
    const sorted = [...region.tiles].sort((a, b) => deep(b) - deep(a) || this.random.next() - 0.5);
    const out = [sorted[0]];
    if (n > 1) {
      const best = deep(sorted[0]);
      const pool = sorted.filter(t => deep(t) >= Math.max(0, best - 1));
      pool.sort((a, b) => Math.hypot(b.gi - out[0].gi, b.gj - out[0].gj) - Math.hypot(a.gi - out[0].gi, a.gj - out[0].gj));
      out.push(pool[0] === out[0] ? sorted[1] ?? sorted[0] : pool[0]);
    }
    return out;
  }

  /**
   * ¿Qué zonas tienen criaturas vivas? Cada criatura cuenta para la zona de su nido, o la zona en la que está o,
   * si anda fuera cazando y sin nido, la más cercana.
   */
  private homesByRegion(regions: BurntRegion[], species: SpeciesDef[]): boolean[] {
    const alive = regions.map(() => false);
    if (!regions.length) return alive;
    const index = new Map<string, number>();
    regions.forEach((r, i) => r.tiles.forEach(t => index.set(`${t.gi},${t.gj}`, i)));
    const ids = new Set(species.map(s => s.id));
    for (const a of this.fauna.animals) {
      if (!ids.has(a.species)) continue;
      const lair = this.fauna.burrows.get(this.fauna.herds.get(a.herd)?.burrow ?? null);
      const at = lair ?? a;
      const k = `${Math.floor(at.x / G)},${Math.floor(at.y / G)}`;
      let i = index.get(k);
      if (i === undefined) {
        // Fuera de toda zona: la más cercana
        let best = Infinity;
        regions.forEach((r, j) => {
          const t = r.tiles[0];
          const d = Math.hypot(t.gi * G - a.x, t.gj * G - a.y);
          if (d < best) { best = d; i = j; }
        });
      }
      if (i !== undefined) alive[i] = true;
    }
    return alive;
  }
}
