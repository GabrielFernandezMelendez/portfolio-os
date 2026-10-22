import { Animal } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { WORLD } from '../../domain/models/world.model';
import { SMELL_SHARPNESS } from '../../config/fauna.config';
import { ageDays, lifeStage } from './needs';

/*
  Sentidos y depredación, comunes a todas las especies (lógica pura: dice qué se huele, a quién cazar y si sale
  bien; la fauna lo aplica). Todo por tiradas: oler algo es menos probable cuanto más lejos, el depredador
  prefiere a los débiles pero no siempre, y cazar sale mal muchas más veces de las que sale bien.
*/

const ISLAND = WORLD.CELLS;

/** Probabilidad de oler algo a `d` celdas (cada vez que lo intenta): alta cerca, nada más allá de su olfato */
export function smellChance(s: SpeciesDef, d: number): number {
  const range = s.senses.smell * ISLAND;
  return d >= range ? 0 : SMELL_SHARPNESS * (1 - d / range);
}

/** Cómo de fácil es una presa: cría, débil (enferma, herida o vieja) o adulta sana */
export type PreyClass = 'young' | 'weak' | 'adult';
export function preyClass(a: Animal, s: SpeciesDef, now: number): PreyClass {
  if (ageDays(a, now) < s.youngDays) return 'young';
  if (a.sickUntil !== null || a.health < 0.5 || lifeStage(a, s, now) === 'elder') return 'weak';
  return 'adult';
}

/** Lo que prefiere el depredador: crías ×3, débiles ×2–3, sola o perdida ×3 (lejos de su manada o despistada) */
const CLASS_WEIGHT: Readonly<Record<PreyClass, number>> = { young: 3, weak: 2.5, adult: 1 };
const ALONE_WEIGHT = 3;

/**
 * Elige presa por olfato entre los animales vivos: cada una que huele (tirada por distancia) entra con su peso
 * (preferencia por especie × lo fácil que es × si está sola); luego, una al azar según los pesos. Las que están
 * dentro de su refugio no se pueden cazar. Devuelve null si no huele a ninguna.
 */
export function choosePrey(
  hunter: Animal, s: SpeciesDef, animals: readonly Animal[], species: readonly SpeciesDef[], alone: (a: Animal) => boolean,
  now: number, random: RandomSource,
): Animal | null {
  const pred = s.predator;
  if (!pred) return null;
  const range = s.senses.smell * ISLAND;
  let total = 0;
  const pool: { a: Animal; w: number }[] = [];
  for (const a of animals) {
    if (a.diedAt !== null || a.inside !== null) continue;
    const ps = species[a.species];
    const like = pred.prey[ps.key];
    if (!like) continue;
    // Las que no puede cazar (un lobo con un humano adulto) ni las mira: solo las de su tipo que sí
    if (!(pred.catch[ps.key]?.[preyClass(a, ps, now)] ?? 0)) continue;
    const d = Math.hypot(a.x - hunter.x, a.y - hunter.y);
    if (d >= range || random.next() >= smellChance(s, d)) continue;
    const w = like * CLASS_WEIGHT[preyClass(a, ps, now)] * (alone(a) ? ALONE_WEIGHT : 1) / (1 + d / ISLAND);
    pool.push({ a, w });
    total += w;
  }
  let r = random.next() * total;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) return p.a;
  }
  return pool[pool.length - 1]?.a ?? null;
}

/**
 * Probabilidad de cazarla al alcanzarla: la de su tipo (adulta, cría o débil) + un poco por cada compañero que
 * caza con él (hasta packMax) + la nieve (la presa se hunde).
 */
export function catchChance(s: SpeciesDef, prey: Animal, preyS: SpeciesDef, helpers: number, snow: boolean, now: number): number {
  const pred = s.predator!;
  const base = pred.catch[preyS.key]?.[preyClass(prey, preyS, now)] ?? 0;
  const pack = Math.min(helpers, pred.packMax - 1) * pred.packBonus;
  return Math.min(0.95, base + pack + (snow ? pred.snowBonus : 0));
}
