import { BurntLand, BurntRegion } from '../../domain/ports/burnt-land.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { SpeciesDef } from '../../domain/models/species.model';
import { Sex } from '../../domain/models/animal.model';
import { WORLD } from '../../domain/models/world.model';
import { SPECIES_DEFS } from '../../config/species.config';
import { FaunaSystem } from './fauna-system';

const G = WORLD.CELLS_PER_TILE;
const DAY = 1440;

/** Lo que se sabe de cada zona de Tierra Quemada: cuándo nacen sus criaturas y si ya nacieron */
interface Record {
  readonly spawnAt: number;
  spawned: boolean;
  tiles: Set<string>;
}

/**
 * Criaturas que nacen con la Tierra Quemada (los goblins), común a cualquier especie con `burntBorn`.
 * Cada hora: mira las zonas de Tierra Quemada; a una zona nueva le apunta cuándo nacerán sus criaturas (tirada
 * de días); llegado el momento, aparecen sus nidos (uno por cada `tilesPerNest` tiles, con su tirada de
 * criaturas). La vida de la zona es la de sus criaturas: mientras quede una viva (en su nido, dentro o cazando
 * cerca), la zona vive y crece; cuando no queda ninguna, remite. Antes de que nazcan, la zona también vive.
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

  /** Nidos de una zona: uno por cada `tilesPerNest` tiles (al menos uno), en tiles al azar, con su tirada de criaturas */
  private spawn(s: SpeciesDef, region: BurntRegion, now: number): number {
    const b = s.burntBorn!;
    const nests = Math.max(1, Math.round(region.tiles.length / b.tilesPerNest));
    let made = 0;
    for (let n = 0; n < nests; n++) {
      const t = region.tiles[Math.floor(this.random.next() * region.tiles.length)];
      const count = b.perNest[0] + Math.floor(this.random.next() * (b.perNest[1] - b.perNest[0] + 1));
      const founders: { sex: Sex; age: 'adult' }[] = [];
      for (let k = 0; k < count; k++) founders.push({ sex: this.random.next() < 0.5 ? 'female' : 'male', age: 'adult' });
      const out = this.fauna.spawnHerd(s.key, t.gi * G + 2, t.gj * G + 2, now, true, founders);
      if (out.length) made++;
    }
    return made;
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
