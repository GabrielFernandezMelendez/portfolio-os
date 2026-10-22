import { SpeciesDef } from '../../domain/models/species.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { GROUPS_PER_CHUNK, LEAVE_HEALTH_SPAN, LEAVE_HUNGRY_BELOW } from '../../config/fauna.config';

/*
  Llegadas y marchas naturales, comunes a todas las especies (lógica pura: dice cuántos grupos caben, la
  probabilidad de que llegue uno y la de que una manada hambrienta se vaya; la fauna lo aplica).
  Es lo que hace que una isla no se quede vacía para siempre: como en las islas de verdad (teoría de islas de
  MacArthur y Wilson), las especies llegan y se van, y el equilibrio sale de las dos cosas. Todo por tiradas.
*/

/**
 * Grupos que caben en la isla ahora: entre GROUPS_PER_CHUNK[0] y [1] por chunk, tirado cada vez. Así el tope
 * también es una probabilidad: unas veces la isla admite más grupos y otras menos.
 */
export function groupsCap(chunks: number, random: RandomSource): number {
  const [lo, hi] = GROUPS_PER_CHUNK;
  return Math.round(chunks * (lo + random.next() * (hi - lo)));
}

/**
 * Probabilidad de que llegue un grupo de la especie: su `arrive`, por el sitio que hay (en grupos: lo que la isla
 * puede alimentar menos los que ya hay, entre lo que ocupa un grupo; como mucho 1) y menos cuantos más grupos
 * suyos haya ya (así no llena la isla una sola especie). Sin sitio, o sin `migration`, 0.
 * Un depredador solo tiene sitio si hay presas: su capacidad sale de la carne en pie.
 */
export function arrivalChance(s: SpeciesDef, population: number, capacity: number, groupsOfSpecies: number, groupSize: number): number {
  const m = s.migration;
  if (!m || groupSize <= 0) return 0;
  const room = (capacity - population) / groupSize;
  if (room <= 0) return 0;
  return (m.arrive * Math.min(1, room)) / (1 + groupsOfSpecies);
}

/**
 * Probabilidad (al día) de que una manada se vaya de la isla por hambre de verdad: nada mientras les quede algo en
 * el estómago (saciedad media por encima de LEAVE_HUNGRY_BELOW); con el estómago vacío, sube con lo que ya les ha
 * quitado el hambre (vida media perdida) hasta su `hungryLeave`. Así primero lo intentan (cazar, viajar, buscar)
 * y se van cuando ya lo están pasando mal: normalmente antes de morir, pero no siempre.
 */
export function leaveChance(s: SpeciesDef, meanSatiety: number, meanHealth: number): number {
  const m = s.migration;
  if (!m || meanSatiety >= LEAVE_HUNGRY_BELOW) return 0;
  return m.hungryLeave * Math.min(1, Math.max(0, (1 - meanHealth) / LEAVE_HEALTH_SPAN));
}
