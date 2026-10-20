import { Animal } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { CALENDAR, DAYS_PER_YEAR, SeasonId } from '../../domain/models/time.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BIRTH_SPREAD_DAYS, BREED_HAPPINESS } from '../../config/fauna.config';
import { ageDays } from './needs';
import { hasAdultMale } from './herds';

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
): Animal | null {
  const b = s.breeding;
  if (female.sex !== 'female' || female.diedAt !== null || female.dueAt !== null) return null;
  if (female.lastRutYear === year || ageDays(female, now) < s.adultDays) return null;
  if (female.satiety < b.minSatiety || female.happiness < BREED_HAPPINESS) return null;
  if (!hasAdultMale(herd, s, now)) return null;
  if (random.next() >= b.conceivePerDay * days) return null;
  female.lastRutYear = year;
  female.litter = female.satiety > b.twinsSatiety && random.next() < b.twinsChance ? 2 : 1;
  female.dueAt = nextSeasonStart(now, b.birthSeason) + Math.floor(random.next() * BIRTH_SPREAD_DAYS * DAY);
  const males = herd.filter(m => m.sex === 'male' && m.diedAt === null && ageDays(m, now) >= s.adultDays);
  return males[Math.floor(random.next() * males.length)] ?? null;
}
