import { Burrow, Herd } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { Stimulus } from '../../domain/models/stimulus.model';
import { FaunaWorld } from '../../domain/ports/fauna-world.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BURROW_ABANDON_DAYS, BURROW_HIT, BURROW_SEARCH } from '../../config/fauna.config';

/** Lo que le ha pasado a una madriguera por una arena que ha caído encima */
export type BurrowHit = { readonly burrow: Burrow; readonly what: 'collapsed' | 'blocked' };

/**
 * Madrigueras (refugios cavados) de las especies que los tienen. Sabe dónde se puede cavar, cuándo está lista,
 * y lo que les hacen las arenas (la Marea las derrumba, la Duna las tapa). Qué hacen los animales con ellas
 * (meterse, salir, huir hacia ellas) lo decide la fauna.
 */
export class Burrows {
  private readonly all = new Map<number, Burrow>();
  private nextId = 1;

  constructor(private readonly world: FaunaWorld, private readonly random: RandomSource) {}

  get list(): readonly Burrow[] {
    return [...this.all.values()];
  }

  get(id: number | null): Burrow | undefined {
    return id === null ? undefined : this.all.get(id);
  }

  /** La madriguera de una manada, si está lista para usarse (cavada y sin tapar) */
  usable(herd: Herd | undefined, now: number): Burrow | undefined {
    const b = this.get(herd?.burrow ?? null);
    return b && b.readyAt <= now && !b.blocked ? b : undefined;
  }

  /**
   * Cava una madriguera para la manada cerca de (x, y): busca una celda en la que se pueda cavar (suelo de la
   * especie, seca, pisable). Tarda `digHours` en estar lista. Devuelve null si no hay sitio a la vista.
   */
  dig(herd: Herd, s: SpeciesDef, x: number, y: number, now: number, ready = false): Burrow | null {
    if (!s.refuge) return null;
    const ok = (gx: number, gy: number) => {
      const m = this.world.materialAt(gx, gy);
      return m !== null && s.refuge!.digIn.includes(m) && this.world.walkable(gx, gy) && !this.world.flooded(gx, gy);
    };
    let spot: { x: number; y: number } | null = ok(Math.floor(x), Math.floor(y)) ? { x: Math.floor(x), y: Math.floor(y) } : null;
    for (let n = 0; n < 24 && !spot; n++) {
      const angle = this.random.next() * Math.PI * 2, r = 1 + this.random.next() * BURROW_SEARCH;
      const gx = Math.floor(x + Math.cos(angle) * r), gy = Math.floor(y + Math.sin(angle) * r);
      if (ok(gx, gy)) spot = { x: gx, y: gy };
    }
    if (!spot) return null;
    const b: Burrow = {
      id: this.nextId++, species: s.id, herd: herd.id, x: spot.x + 0.5, y: spot.y + 0.5,
      readyAt: ready ? now : now + s.refuge.digHours * 60, blocked: false, abandonedAt: null,
    };
    this.all.set(b.id, b);
    herd.burrow = b.id;
    return b;
  }

  /** Ocupa una madriguera abandonada de su especie que tenga a la vista (antes que cavar una nueva) */
  adopt(herd: Herd, s: SpeciesDef, x: number, y: number): Burrow | null {
    let best: Burrow | null = null, bestD = BURROW_SEARCH;
    for (const b of this.all.values()) {
      if (b.abandonedAt === null || b.species !== s.id) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) return null;
    best.herd = herd.id;
    best.abandonedAt = null;
    herd.burrow = best.id;
    return best;
  }

  /**
   * Una vez al día: las madrigueras cuya manada ya no existe quedan abandonadas; si nadie las ocupa en
   * BURROW_ABANDON_DAYS, se hunden (así no se llena la isla de agujeros vacíos).
   */
  tidy(alive: (herd: number) => boolean, now: number): void {
    for (const b of [...this.all.values()]) {
      if (alive(b.herd)) {
        b.abandonedAt = null;
        continue;
      }
      if (b.abandonedAt === null) b.abandonedAt = now;
      else if (now - b.abandonedAt > BURROW_ABANDON_DAYS * 1440) this.all.delete(b.id);
    }
  }

  /** Una arena cae cerca de alguna entrada: la Marea la derrumba (con probabilidad) y la Duna la tapa */
  hit(stim: Stimulus, species: readonly SpeciesDef[]): BurrowHit[] {
    if (stim.type !== 'dig' && stim.type !== 'sandFall') return [];
    const out: BurrowHit[] = [];
    for (const b of this.all.values()) {
      if (Math.hypot(b.x - stim.gx, b.y - stim.gy) > BURROW_HIT) continue;
      const refuge = species[b.species].refuge!;
      if (stim.type === 'dig' && this.random.next() < refuge.collapse) {
        this.all.delete(b.id);
        out.push({ burrow: b, what: 'collapsed' });
      } else if (stim.type === 'sandFall' && !b.blocked) {
        b.blocked = true;
        out.push({ burrow: b, what: 'blocked' });
      }
    }
    return out;
  }

  /** ¿Está inundada la entrada? */
  flooded(b: Burrow): boolean {
    return this.world.flooded(Math.floor(b.x), Math.floor(b.y));
  }

  /** La manada se queda sin madriguera (la abandona o se ha derrumbado) */
  remove(id: number): void {
    this.all.delete(id);
  }
}
