import { Animal } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { CALM_PREDATOR, SIGHT_COVER, SPOT_EATING, SPOT_FACTOR } from '../../config/fauna.config';

/*
  Vista y oído (comunes a todas las especies; cada una pone sus alcances en `senses`). Aquí solo las cuentas; quién
  mira a quién y qué hace al verlo lo lleva FaunaSystem.
*/

/** Lado (celdas) de cada casilla de la rejilla de vecinos */
const BUCKET = 16;

/**
 * Rejilla de vecinos: se rehace una vez por minuto y cada animal mira solo las casillas a su alcance, no a todos los
 * de la isla (con ~150 animales, unos cientos de distancias por minuto).
 */
export class Neighbours {
  private readonly cells = new Map<number, Animal[]>();

  private static key(i: number, j: number): number {
    return (i + 4096) * 8192 + (j + 4096);
  }

  /** Los vivos y fuera de su refugio (los de dentro ni se ven ni ven) */
  build(animals: readonly Animal[]): void {
    for (const list of this.cells.values()) list.length = 0;
    for (const a of animals) {
      if (a.diedAt !== null || a.inside !== null) continue;
      const k = Neighbours.key(Math.floor(a.x / BUCKET), Math.floor(a.y / BUCKET));
      let list = this.cells.get(k);
      if (!list) this.cells.set(k, (list = []));
      list.push(a);
    }
  }

  /** Cada animal a `r` celdas o menos de (x, y) (con su distancia) */
  each(x: number, y: number, r: number, fn: (b: Animal, d: number) => void): void {
    const i0 = Math.floor((x - r) / BUCKET), i1 = Math.floor((x + r) / BUCKET);
    const j0 = Math.floor((y - r) / BUCKET), j1 = Math.floor((y + r) / BUCKET);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.cells.get(Neighbours.key(i, j));
        if (!list) continue;
        for (const b of list) {
          const d = Math.hypot(b.x - x, b.y - y);
          if (d <= r) fn(b, d);
        }
      }
    }
  }
}

/** Hasta dónde ve ahora: su vista, menos de noche y entre árboles */
export function sightRange(s: SpeciesDef, night: boolean, covered: boolean): number {
  return s.senses.sight * (night ? s.senses.night : 1) * (covered ? SIGHT_COVER : 1);
}

/**
 * Probabilidad de ver a un depredador que acecha agachado a `d` celdas (cada vez que mira): más cerca, más fácil;
 * cuanto más sigiloso y menos atenta (o comiendo), más difícil.
 */
export function spotChance(watcher: SpeciesDef, hunter: SpeciesDef, d: number, range: number, eating: boolean): number {
  if (d >= range) return 0;
  const p = (1 - d / range) * (1 - (hunter.senses.stealth ?? 0)) * watcher.senses.vigilance * SPOT_FACTOR * (eating ? SPOT_EATING : 1);
  return Math.min(0.95, p);
}

/** ¿Va de caza? (persiguiendo o acechando, o con hambre de cazar). Uno saciado asusta menos */
export function hunting(b: Animal, bs: SpeciesDef): boolean {
  return b.hunt !== null || (!!bs.predator && b.satiety < bs.predator.huntBelow);
}

/** Distancias de alerta y de huida de una presa ante un depredador (la mitad si no caza) */
export function waryOf(s: SpeciesDef, b: Animal, bs: SpeciesDef): { alert: number; flee: number } | null {
  const w = s.senses.wary;
  if (!w) return null;
  const k = hunting(b, bs) ? 1 : CALM_PREDATOR;
  return { alert: w.alert * k, flee: w.flee * k };
}
