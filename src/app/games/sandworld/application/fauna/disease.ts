import { Animal } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { RandomSource } from '../../domain/ports/random-source.port';

const DAY = 1440;

/*
  Enfermedad contagiosa (tipo mixomatosis): el freno natural de una especie que cría mucho. Todo por probabilidad:
  brota con superpoblación, se contagia entre los de la misma manada que están cerca, y al acabar mata a unos y
  deja inmunes a otros. Lógica pura: dice qué pasa; la fauna lo aplica (muertes, diario, crónica).
*/

/** Celdas a las que un enfermo contagia a otro de su manada */
const CONTAGION_RANGE = 3;

/**
 * ¿Brota hoy? Solo si la especie está apretada por encima de `crowdedAbove`; cuanto más apretada, más probable
 * (su `outbreak` por el cuadrado de lo que se pasa). Elige al primer enfermo (uno sano al azar) o null.
 */
export function outbreak(animals: readonly Animal[], s: SpeciesDef, crowd: number, random: RandomSource): Animal | null {
  const d = s.disease;
  if (!d || crowd <= d.crowdedAbove || random.next() >= d.outbreak * (crowd / d.crowdedAbove) ** 2) return null;
  const healthy = animals.filter(a => a.sickUntil === null && !a.immune);
  return healthy.length ? healthy[Math.floor(random.next() * healthy.length)] : null;
}

/** Cae enfermo durante los días de la enfermedad */
export function infect(a: Animal, s: SpeciesDef, now: number): void {
  a.sickUntil = now + (s.disease?.days ?? 0) * DAY;
}

/**
 * Una hora: cada enfermo contagia a cada sano de su manada que tenga cerca (la probabilidad al día repartida en
 * horas). Devuelve los recién contagiados.
 */
export function spread(members: readonly Animal[], s: SpeciesDef, now: number, random: RandomSource): Animal[] {
  const d = s.disease;
  if (!d) return [];
  const perHour = 1 - Math.pow(1 - d.spread, 1 / 24);
  const caught: Animal[] = [];
  for (const sick of members) {
    if (sick.sickUntil === null || caught.includes(sick)) continue;
    for (const m of members) {
      if (m.sickUntil !== null || m.immune || caught.includes(m)) continue;
      // Dentro de la misma madriguera, o fuera y cerca
      const together = (sick.inside !== null && sick.inside === m.inside) || Math.hypot(sick.x - m.x, sick.y - m.y) <= CONTAGION_RANGE;
      if (together && random.next() < perHour) caught.push(m);
    }
  }
  for (const m of caught) infect(m, s, now);
  return caught;
}

/** Acaba la enfermedad: devuelve true si muere; si no, queda inmune */
export function recover(a: Animal, s: SpeciesDef, random: RandomSource): boolean {
  a.sickUntil = null;
  if (random.next() < (s.disease?.lethality ?? 0)) return true;
  a.immune = true;
  return false;
}
