import { SpeciesDef } from '../../domain/models/species.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { GROUPS_PER_CHUNK, LEAVE_HEALTH_SPAN, LEAVE_HUNGRY_BELOW, RETURN_AFTER_DAYS } from '../../config/fauna.config';

/*
  Llegadas y marchas naturales, comunes a todas las especies (lógica pura: dice cuántos grupos caben, la
  probabilidad de que llegue uno y la de que uno se vaya; la fauna lo aplica).
  Es lo que hace que una isla no se quede vacía para siempre: como en las islas de verdad (teoría de islas de
  MacArthur y Wilson), las especies llegan y se van, y el equilibrio sale de las dos cosas. Todo por tiradas.
  Dos topes: el de la isla (todos los grupos) y el de cada especie, para que nunca la llene una sola.
*/

/** Lo que la isla sabe de una especie para decidir si llega un grupo suyo */
export interface ArrivalContext {
  readonly population: number;
  /** Lo que la isla puede alimentar (animales) */
  readonly capacity: number;
  /** Grupos suyos que hay ya */
  readonly groups: number;
  /** Lo que ocupa un grupo al llegar (sus fundadores) */
  readonly groupSize: number;
  /** Su tope de grupos ahora (tirado) */
  readonly cap: number;
  /** Días desde que se vio por última vez en la isla (Infinity si nunca ha estado) */
  readonly absentDays: number;
  /** ¿Hay cadáveres con carne en la isla? (su olor atrae a los carroñeros de fuera) */
  readonly carrion: boolean;
}

/** Tope tirado entre dos valores por chunk (al menos 1 si el máximo lo permite) */
function cap(chunks: number, [lo, hi]: readonly [number, number], random: RandomSource): number {
  return Math.max(Math.min(1, Math.round(chunks * hi)), Math.round(chunks * (lo + random.next() * (hi - lo))));
}

/**
 * Grupos que caben en la isla ahora: entre GROUPS_PER_CHUNK[0] y [1] por chunk, tirado cada vez. Así el tope
 * también es una probabilidad: unas veces la isla admite más grupos y otras menos.
 */
export function groupsCap(chunks: number, random: RandomSource): number {
  return cap(chunks, GROUPS_PER_CHUNK, random);
}

/** Grupos de una especie que caben ahora (su `groupsPerChunk`, tirado cada vez) */
export function speciesCap(s: SpeciesDef, chunks: number, random: RandomSource): number {
  return s.migration ? cap(chunks, s.migration.groupsPerChunk, random) : 0;
}

/** Lo más que admite la isla de una especie (sin tirada): por encima, la especie está de más */
export function speciesCapMax(s: SpeciesDef, chunks: number): number {
  return s.migration ? Math.max(1, Math.round(chunks * s.migration.groupsPerChunk[1])) : 0;
}

/**
 * Probabilidad de que llegue un grupo de la especie: su `arrive`, por el sitio que hay (en grupos: lo que la isla
 * puede alimentar menos los que ya hay, entre lo que ocupa un grupo; como mucho 1) y menos cuantos más grupos
 * suyos haya ya. Nada si ha llegado a su tope, si desapareció hace menos de RETURN_AFTER_DAYS[0] días (perderla es un
 * castigo de verdad; después la tirada sube poco a poco hasta RETURN_AFTER_DAYS[1]), si solo llega cuando no queda ninguno y aún hay, o si la atrae la carroña y no hay.
 * Un depredador solo tiene sitio si hay presas: su capacidad sale de la carne en pie.
 */
export function arrivalChance(s: SpeciesDef, c: ArrivalContext): number {
  const m = s.migration;
  if (!m || c.groupSize <= 0 || c.groups >= c.cap) return 0;
  // Desaparecida: nada antes de RETURN_AFTER_DAYS[0]; luego la tirada va subiendo hasta [1] (suele volver entre
  // los 60 y los 80 días, a veces más tarde)
  const [wait, ramp] = RETURN_AFTER_DAYS;
  if (c.population === 0 && c.absentDays < wait) return 0;
  const returning = c.population === 0 && c.absentDays < ramp ? (c.absentDays - wait) / (ramp - wait) : 1;
  if (m.onlyIfAbsent && c.population > 0) return 0;
  if (m.carrionLure && !c.carrion) return 0;
  const room = (c.capacity - c.population) / c.groupSize;
  if (room <= 0) return 0;
  return Math.min(1, (m.arrive * Math.min(1, room) * (m.carrionLure ?? 1) * returning) / (1 + c.groups));
}

/**
 * Probabilidad (cada vez que se mira) de que un grupo de una especie que se ha pasado de su tope se vaya: su
 * `crowdLeave` por cada grupo de más (como mucho 1). Se va uno cada vez, no todos de golpe.
 */
export function crowdLeaveChance(s: SpeciesDef, groups: number, chunks: number): number {
  const m = s.migration;
  if (!m) return 0;
  const extra = groups - speciesCapMax(s, chunks);
  return extra > 0 ? Math.min(1, m.crowdLeave * extra) : 0;
}

/**
 * Probabilidad (al día) de que una manada se vaya de la isla por hambre de verdad: nada mientras les quede algo en
 * el estómago (saciedad media por encima de LEAVE_HUNGRY_BELOW); con el estómago vacío, sube con lo que ya les ha
 * quitado el hambre (vida media perdida) hasta su `hungryLeave`. Así primero lo intentan (cazar, viajar, buscar)
 * y se van cuando ya lo están pasando mal: normalmente antes de morir, pero no siempre. Sin `hungryLeave`, nunca.
 */
export function leaveChance(s: SpeciesDef, meanSatiety: number, meanHealth: number): number {
  const m = s.migration;
  if (!m?.hungryLeave || meanSatiety >= LEAVE_HUNGRY_BELOW) return 0;
  return m.hungryLeave * Math.min(1, Math.max(0, (1 - meanHealth) / LEAVE_HEALTH_SPAN));
}

/**
 * Lo apretada que está una especie (0 = holgada, 1 = llena): lo que más apriete de su comida (población entre
 * capacidad), su colonia más llena (miembros entre su tamaño máximo) y sus grupos entre su tope en la isla.
 */
export function crowding(s: SpeciesDef, foodDensity: number, largestGroup: number, groups: number, chunks: number): number {
  const fill = largestGroup / s.herd.max;
  const max = chunks > 0 ? speciesCapMax(s, chunks) : 0;
  return Math.max(foodDensity, fill, max > 0 ? groups / max : 0);
}
