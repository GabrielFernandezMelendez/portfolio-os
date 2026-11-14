import { Animal } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { ageDays } from './needs';

/** Centro de los animales vivos de una lista (sin contar `except`); null si no queda nadie */
export function centre(members: readonly Animal[], except?: Animal): { x: number; y: number } | null {
  let x = 0, y = 0, n = 0;
  for (const m of members) {
    if (m === except || m.diedAt !== null) continue;
    x += m.x;
    y += m.y;
    n++;
  }
  return n ? { x: x / n, y: y / n } : null;
}

/** Guía de la manada: la hembra adulta más vieja; si no hay, el adulto más viejo; si no, el más viejo */
export function leaderOf(members: readonly Animal[], s: SpeciesDef, now: number): Animal | null {
  let best: Animal | null = null, bestScore = -Infinity;
  for (const m of members) {
    if (m.diedAt !== null) continue;
    const age = ageDays(m, now);
    const score = age + (age >= s.adultDays ? 10000 : 0) + (m.sex === 'female' ? 5000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** ¿Hay un macho adulto en la manada? (sin él no hay crías) */
export const hasAdultMale = (members: readonly Animal[], s: SpeciesDef, now: number): boolean =>
  members.some(m => m.diedAt === null && m.sex === 'male' && ageDays(m, now) >= s.adultDays);

/**
 * Reparto de una manada demasiado grande: se va la segunda hembra adulta más vieja con sus crías,
 * y se le unen los más jóvenes hasta que las dos mitades quedan parecidas. Devuelve los que se van.
 */
export function splitOff(members: readonly Animal[], s: SpeciesDef, now: number): Animal[] {
  const alive = members.filter(m => m.diedAt === null);
  const leader = leaderOf(alive, s, now);
  const females = alive
    .filter(m => m !== leader && m.sex === 'female' && ageDays(m, now) >= s.adultDays)
    .sort((a, b) => a.bornAt - b.bornAt);
  const newLeader = females[0];
  if (!newLeader) return [];
  const leaving = new Set<Animal>([newLeader, ...alive.filter(m => m.mother === newLeader.id)]);
  // Las crías no se separan de su madre: se van o se quedan con ella (las de madre muerta, como cualquiera)
  const withMother = (m: Animal) => ageDays(m, now) < s.youngDays && alive.some(o => o.id === m.mother);
  const rest = alive
    .filter(m => !leaving.has(m) && m !== leader && m.mother !== leader?.id && !withMother(m))
    .sort((a, b) => b.bornAt - a.bornAt);
  for (const m of rest) {
    if (leaving.size >= Math.floor(alive.length / 2)) break;
    leaving.add(m);
    // Una madre se lleva a sus crías
    for (const kid of alive) if (kid.mother === m.id) leaving.add(kid);
  }
  return [...leaving];
}

/** Una manada vista de lejos: dónde está su guía (el corazón de la manada) y cuántos son */
export interface HerdMark {
  readonly herd: number;
  readonly species: number;
  /** Id de la guía (tocar la moneda abre su ficha) y su posición */
  readonly leader: number;
  readonly x: number;
  readonly y: number;
  readonly count: number;
}

/** Monedas de la vista de lejos: una por manada, en su guía. Una sola pasada por los animales. */
export function herdMarks(animals: readonly Animal[], species: readonly SpeciesDef[], now: number): HerdMark[] {
  const groups = new Map<number, Animal[]>();
  for (const a of animals) {
    if (a.diedAt !== null) continue;
    let g = groups.get(a.herd);
    if (!g) groups.set(a.herd, (g = []));
    g.push(a);
  }
  const out: HerdMark[] = [];
  for (const [herd, members] of groups) {
    const lead = leaderOf(members, species[members[0].species], now) ?? members[0];
    out.push({ herd, species: lead.species, leader: lead.id, x: lead.x, y: lead.y, count: members.length });
  }
  return out;
}
