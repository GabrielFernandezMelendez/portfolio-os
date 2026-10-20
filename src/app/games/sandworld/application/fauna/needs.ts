import { Animal, Factor } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import {
  DEHYDRATE_HEALTH_PER_DAY, ELDER_FROM, EXHAUSTED_HEALTH_PER_DAY, FRAIL_FACTOR, HAPPY_RATE, HEAL_PER_DAY, STARVE_HEALTH_PER_DAY,
} from '../../config/fauna.config';

const DAY = 1440;

/** Edad en días */
export const ageDays = (a: Animal, now: number): number => (now - a.bornAt) / DAY;

/** Etapa de la vida que se enseña: cría, joven, adulta o vieja (por la especie, no por su vida oculta) */
export type LifeStage = 'young' | 'juvenile' | 'adult' | 'elder';
export function lifeStage(a: Animal, s: SpeciesDef, now: number): LifeStage {
  const age = ageDays(a, now);
  if (age < s.youngDays) return 'young';
  if (age < s.adultDays) return 'juvenile';
  return age < a.lifespan * ELDER_FROM ? 'adult' : 'elder';
}

/** Crías y viejos son frágiles: el hambre y el cansancio les quitan más vida */
export function frail(a: Animal, s: SpeciesDef, now: number): boolean {
  const st = lifeStage(a, s, now);
  return st === 'young' || st === 'elder';
}

/** Tamaño de su estómago respecto a un adulto (las crías, la mitad: comen menos pero tienen hambre igual de rápido) */
export const appetite = (a: Animal, s: SpeciesDef, now: number): number => (ageDays(a, now) < s.youngDays ? 0.5 : 1);

/**
 * Pasan `minutes` minutos: bajan la saciedad y la hidratación; baja el sueño si está despierto (o sube si duerme);
 * la vida baja con el estómago vacío o sin descanso y se recupera bien comido y descansado.
 * Devuelve true si se ha quedado sin vida.
 */
export function passTime(a: Animal, s: SpeciesDef, minutes: number, now: number, restBonus = 1): boolean {
  const d = minutes / DAY;
  a.satiety = Math.max(0, a.satiety - s.hungerPerDay * d);
  if (a.action !== 'drink') a.hydration = Math.max(0, a.hydration - s.thirstPerDay * d);
  if (a.action === 'sleep') a.rest = Math.min(1, a.rest + s.restPerHour * (minutes / 60) * restBonus);
  else a.rest = Math.max(0, a.rest - s.tirePerDay * d);
  const weak = frail(a, s, now) ? FRAIL_FACTOR : 1;
  if (a.satiety <= 0) a.health -= STARVE_HEALTH_PER_DAY * d * weak;
  if (a.hydration <= 0) a.health -= DEHYDRATE_HEALTH_PER_DAY * d * weak;
  if (a.rest <= 0) a.health -= EXHAUSTED_HEALTH_PER_DAY * d * weak;
  if (a.health <= 0) return true;
  if (a.satiety > 0.5 && a.hydration > 0.4 && a.rest > 0.4) a.health = Math.min(1, a.health + HEAL_PER_DAY * d);
  return a.health <= 0;
}

/** Lo que el entorno le cuenta a su felicidad (lo calcula la fauna en cada repaso) */
export interface Mood {
  /** Comida en su tile (relativa a lo que necesita) */
  readonly goodFood: boolean;
  readonly ateFavourite: boolean;
  /** Animales de su manada (contándose) */
  readonly herdSize: number;
  readonly herdMin: number;
  readonly waterNear: boolean;
  /** Densidad de su especie en la isla (población / capacidad) */
  readonly crowded: boolean;
  readonly fear: boolean;
}

/**
 * Felicidad que le corresponde: sus necesidades más lo que le rodea. La felicidad real se acerca a ella poco a poco
 * (HAPPY_RATE por día). Guarda en `factors` lo que más le influye, para la ficha ("Le afecta").
 */
export function updateHappiness(a: Animal, mood: Mood, minutes: number): void {
  const factors: Factor[] = [];
  const add = (key: string, value: number, when: boolean) => { if (when) factors.push({ key, value }); };
  add('goodFood', 0.1, mood.goodFood);
  add('favourite', 0.1, mood.ateFavourite);
  add('herd', 0.1, mood.herdSize >= mood.herdMin);
  add('alone', -0.2, mood.herdSize <= 1);
  add('smallHerd', -0.05, mood.herdSize > 1 && mood.herdSize < mood.herdMin);
  add('waterNear', 0.05, mood.waterNear);
  add('waterFar', -0.1, !mood.waterNear);
  add('crowded', -0.15, mood.crowded);
  add('fear', -0.2, mood.fear);
  add('hungry', -0.15, a.satiety < 0.25);
  add('thirsty', -0.15, a.hydration < 0.25);
  add('tired', -0.1, a.rest < 0.2);
  add('hurt', -0.1, a.health < 0.5);
  const base = 0.25 * a.satiety + 0.2 * a.hydration + 0.15 * a.rest + 0.25 * a.health;
  const target = Math.max(0, Math.min(1, base + factors.reduce((s, f) => s + f.value, 0)));
  const step = Math.min(1, (HAPPY_RATE * minutes) / DAY);
  a.happiness += (target - a.happiness) * step;
  a.factors = factors.sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4);
}
