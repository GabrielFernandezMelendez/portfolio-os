import { Herd } from '../../domain/models/animal.model';
import { StimulusType } from '../../domain/models/stimulus.model';
import { ReactionDef, HABIT_FORGET_DAYS, HABIT_MAX, HABIT_STEP } from '../../config/temperament.config';

/*
  Reacciones a los estímulos, comunes a todas las especies (lógica pura): cuánto miedo da algo según lo lejos
  que pasa y la costumbre de la manada, la costumbre que se gana o se pierde, y las zonas que la manada evita.
*/

const DAY = 1440;

/** Costumbre de la manada a un tipo de estímulo ahora (se olvida poco a poco si hace tiempo que no lo notan) */
export function habitLevel(herd: Herd | undefined, type: StimulusType, now: number): number {
  const h = herd?.habit.get(type);
  if (!h) return 0;
  return Math.max(0, h.level - (now - h.at) / (HABIT_FORGET_DAYS * DAY) * HABIT_MAX);
}

/**
 * La manada ha notado un estímulo: si no ha pasado nada malo se acostumbra un poco; si alguien ha salido herido,
 * pierde toda la costumbre (ahora le tiene más respeto).
 */
export function habituate(herd: Herd, type: StimulusType, now: number, harmed: boolean): void {
  const level = harmed ? 0 : Math.min(HABIT_MAX, habitLevel(herd, type, now) + HABIT_STEP);
  herd.habit.set(type, { level, at: now });
}

/** Miedo que provoca un estímulo a `distance` celdas: entero cerca, la mitad en el borde de su alcance, menos con costumbre */
export function fearOf(def: ReactionDef, distance: number, strength: number, habit: number): number {
  if (def.reaction === 'ignore' || distance > def.radius) return 0;
  const near = Number.isFinite(def.radius) ? 1 - 0.5 * (distance / def.radius) : 1;
  return Math.max(0, Math.min(1, def.fear * strength * near * (1 - habit)));
}

/** ¿Está esta posición en una zona que la manada evita? (y de paso olvida las que ya caducaron) */
export function inZone(herd: Herd | undefined, x: number, y: number, now: number): boolean {
  if (!herd || !herd.zones.length) return false;
  herd.zones = herd.zones.filter(z => z.until > now);
  return herd.zones.some(z => Math.hypot(x - z.x, y - z.y) <= z.r);
}

/** La manada evitará esta zona hasta `until` (si ya evitaba una igual, la alarga) */
export function addZone(herd: Herd, x: number, y: number, r: number, until: number): void {
  const same = herd.zones.find(z => Math.hypot(z.x - x, z.y - y) < 2);
  if (same) {
    same.until = Math.max(same.until, until);
    same.r = Math.max(same.r, r);
  } else herd.zones.push({ x, y, r, until });
}
