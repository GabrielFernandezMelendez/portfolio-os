import { Animal } from '../../domain/models/animal.model';
import { RutBreeding, SeasonBreeding, SpeciesDef } from '../../domain/models/species.model';
import { CALENDAR, DAYS_PER_YEAR, SeasonId, toGameTime } from '../../domain/models/time.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BIRTH_SPREAD_DAYS, BREED_HAPPINESS } from '../../config/fauna.config';
import { ageDays } from './needs';
import { hasAdultMale, leaderOf } from './herds';

const DAY = CALENDAR.MINUTES_PER_DAY;

/** Primer minuto de la próxima vez que empiece esta estación (después de `now`) */
export function nextSeasonStart(now: number, season: SeasonId): number {
  const year = DAYS_PER_YEAR * DAY;
  let start = Math.floor(now / year) * year + season * CALENDAR.DAYS_PER_SEASON * DAY;
  while (start <= now) start += year;
  return start;
}

/**
 * Celo: una hembra adulta con un macho adulto en su manada puede quedar preñada (una vez al año).
 * Solo mira lo bien comida y lo contenta que está AHORA, no cuántos son: con mucha comida en otoño quedan
 * preñadas casi todas (y algunas de gemelos), aunque luego, en primavera, no haya comida para tantos.
 * Devuelve el macho (para su diario) o null si no ha quedado preñada.
 */
export function tryConceive(
  female: Animal, herd: readonly Animal[], s: SpeciesDef, now: number, year: number, days: number, random: RandomSource,
  scarce = false,
): Animal | null {
  const b = s.breeding as RutBreeding;
  if (female.sex !== 'female' || female.diedAt !== null || female.dueAt !== null) return null;
  if (female.lastRutYear === year || ageDays(female, now) < s.adultDays) return null;
  if (female.satiety < b.minSatiety || female.happiness < BREED_HAPPINESS) return null;
  if (!hasAdultMale(herd, s, now)) return null;
  // Solo la pareja dominante (lobo): la hembra guía y el macho adulto más viejo
  if (b.dominantOnly && leaderOf(herd, s, now) !== female) return null;
  if (random.next() >= b.conceivePerDay * days) return null;
  female.lastRutYear = year;
  female.litter = b.litter
    ? litterSize({ litter: b.litter, crowdShift: b.scarceShift ?? 0, hungryShift: 1 }, female.satiety, scarce, random)
    : female.satiety > b.twinsSatiety && random.next() < b.twinsChance ? 2 : 1;
  female.dueAt = nextSeasonStart(now, b.birthSeason) + Math.floor(random.next() * BIRTH_SPREAD_DAYS * DAY);
  const males = herd.filter(m => m.sex === 'male' && m.diedAt === null && ageDays(m, now) >= s.adultDays);
  if (b.dominantOnly) return males.sort((x, y) => x.bornAt - y.bornAt)[0] ?? null;
  return males[Math.floor(random.next() * males.length)] ?? null;
}

/**
 * Cría por temporada (conejo): durante sus estaciones de cría, cada día una hembra adulta, bien comida, con un
 * macho adulto en su manada y sin estar ya preñada, queda preñada con `conceivePerDay` (también nada más parir).
 * Cuántas crías espera es otra tirada (litterSize). Devuelve el macho o null.
 */
export function tryConceiveSeason(
  female: Animal, herd: readonly Animal[], s: SpeciesDef, now: number, crowded: boolean, random: RandomSource,
): Animal | null {
  const b = s.breeding as SeasonBreeding;
  if (female.sex !== 'female' || female.diedAt !== null || female.dueAt !== null || female.sickUntil !== null) return null;
  if (ageDays(female, now) < s.adultDays || female.satiety < b.minSatiety) return null;
  if (!hasAdultMale(herd, s, now)) return null;
  if (random.next() >= b.conceivePerDay) return null;
  female.litter = litterSize(b, female.satiety, crowded, random);
  female.dueAt = now + b.gestationDays * DAY;
  const males = herd.filter(m => m.sex === 'male' && m.diedAt === null && ageDays(m, now) >= s.adultDays);
  return males[Math.floor(random.next() * males.length)] ?? null;
}

/**
 * Cuántas crías: una tirada con los pesos de la especie (unas tienen pocas, otras muchas). Con superpoblación o
 * hambre la tirada baja unos puestos, pero nunca por debajo del mínimo.
 */
export function litterSize(
  b: { readonly litter: SeasonBreeding['litter']; readonly crowdShift: number; readonly hungryShift: number },
  satiety: number, crowded: boolean, random: RandomSource,
): number {
  const { sizes, weights } = b.litter;
  const total = weights.reduce((t, w) => t + w, 0);
  let r = random.next() * total, i = 0;
  while (i < weights.length - 1 && r >= weights[i]) r -= weights[i++];
  const shift = (crowded ? b.crowdShift : 0) + (satiety < 0.5 ? b.hungryShift : 0);
  return sizes[Math.max(0, i - shift)];
}

/**
 * Una hembra adulta que llega a la isla ya preñada (especies de celo): si llega entre el celo y la época de partos,
 * tirada de `chance`; pare como si hubiera quedado preñada en el celo (en su época de partos, repartidos unos días).
 * Así un grupo que llega en primavera (o en invierno) trae crías ese mismo año. Devuelve si viene preñada.
 */
export function arrivePregnant(female: Animal, s: SpeciesDef, now: number, year: number, chance: number, random: RandomSource): boolean {
  const b = s.breeding;
  if (b.mode !== 'rut' || female.sex !== 'female' || female.dueAt !== null || ageDays(female, now) < s.adultDays) return false;
  // Solo entre el celo (ya pasado) y los partos: la estación de partos o las anteriores hasta el celo
  const season = toGameTime(now).season;
  const seasonsSinceRut = (season - b.rutSeason + 4) % 4;
  const seasonsToBirth = (b.birthSeason - b.rutSeason + 4) % 4;
  if (seasonsSinceRut === 0 || seasonsSinceRut > seasonsToBirth) return false;
  if (random.next() >= chance) return false;
  female.lastRutYear = year;
  female.litter = b.litter
    ? litterSize({ litter: b.litter, crowdShift: 0, hungryShift: 1 }, female.satiety, false, random)
    : female.satiety > b.twinsSatiety && random.next() < b.twinsChance ? 2 : 1;
  const start = season === b.birthSeason ? now : nextSeasonStart(now, b.birthSeason);
  female.dueAt = start + Math.floor(random.next() * BIRTH_SPREAD_DAYS * DAY);
  return true;
}
