// Calendario del mundo. Reglas puras: no saben nada del tiempo real ni de la velocidad.

export const Season = {
  SPRING: 0,
  SUMMER: 1,
  AUTUMN: 2,
  WINTER: 3,
} as const;

export type SeasonId = (typeof Season)[keyof typeof Season];

export const CALENDAR = {
  MINUTES_PER_DAY: 1440,
  /** 30 días × 6 min = 3 h reales por estación a x1 */
  DAYS_PER_SEASON: 30,
  SEASONS_PER_YEAR: 4,
  /** Minuto del día en que amanece y anochece (centro de la transición) */
  DAWN: 6 * 60,
  DUSK: 20 * 60,
  /** Duración de cada transición de luz, en minutos de juego (6 h = 90 s reales a x1) */
  TRANSITION: 6 * 60,
} as const;

export const DAYS_PER_YEAR = CALENDAR.DAYS_PER_SEASON * CALENDAR.SEASONS_PER_YEAR;

/** Instante del mundo. Todo se deriva de `totalMinutes` (minutos de juego desde el inicio). */
export interface GameTime {
  readonly totalMinutes: number;
  readonly year: number;          // desde 1
  readonly season: SeasonId;
  readonly dayOfSeason: number;   // 1..DAYS_PER_SEASON
  readonly day: number;           // día absoluto, desde 1
  readonly hour: number;          // 0..23
  readonly minute: number;        // 0..59
  readonly minuteOfDay: number;   // 0..1439
}

export function toGameTime(totalMinutes: number): GameTime {
  const total = Math.max(0, Math.floor(totalMinutes));
  const dayIndex = Math.floor(total / CALENDAR.MINUTES_PER_DAY);
  const minuteOfDay = total - dayIndex * CALENDAR.MINUTES_PER_DAY;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  return {
    totalMinutes: total,
    year: Math.floor(dayIndex / DAYS_PER_YEAR) + 1,
    season: Math.floor(dayOfYear / CALENDAR.DAYS_PER_SEASON) as SeasonId,
    dayOfSeason: (dayOfYear % CALENDAR.DAYS_PER_SEASON) + 1,
    day: dayIndex + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    minuteOfDay,
  };
}
