import { CALENDAR, GameTime } from '../../domain/models/time.model';
import {
  DAILY_TEMPERATURE_SWING, SEASON_BLEND_DAYS, SEASON_TEMPERATURE, WARMEST_MINUTE,
} from '../../config/climate.config';

/**
 * Desvío global de temperatura del momento: el de la estación (con transición suave al final de cada una)
 * más el del día y la noche. Lo usan el agua (evaporación, hielo) y el frío y el calor; los biomas NO,
 * porque dependen del clima medio del tile (la nieve de invierno no convierte el bosque en tundra).
 */
export class ClimateState {
  private seasonOffset: number = SEASON_TEMPERATURE[0];
  private dailyOffset = 0;
  /** 0..1: cuánto se parece el momento a cada estación (para el tono de color) */
  private blend = { from: 0, to: 0, t: 0 };

  /** Desvío total que se suma a la temperatura de cada tile */
  get offset(): number {
    return this.seasonOffset + this.dailyOffset;
  }

  /** Estación de la que viene y a la que va el clima, y cuánto lleva de transición (0..1) */
  get seasonBlend(): { readonly from: number; readonly to: number; readonly t: number } {
    return this.blend;
  }

  update(time: GameTime): void {
    const season = time.season;
    const next = (season + 1) % CALENDAR.SEASONS_PER_YEAR;
    const start = CALENDAR.DAYS_PER_SEASON - SEASON_BLEND_DAYS;
    const dayFloat = time.dayOfSeason - 1 + time.minuteOfDay / CALENDAR.MINUTES_PER_DAY;
    const t = dayFloat <= start ? 0 : (dayFloat - start) / SEASON_BLEND_DAYS;
    // Suavizado: arranca y termina despacio
    const s = t * t * (3 - 2 * t);
    this.seasonOffset = SEASON_TEMPERATURE[season] + (SEASON_TEMPERATURE[next] - SEASON_TEMPERATURE[season]) * s;
    this.blend = { from: season, to: next, t: s };
    this.dailyOffset = DAILY_TEMPERATURE_SWING *
      Math.cos(((time.minuteOfDay - WARMEST_MINUTE) / CALENDAR.MINUTES_PER_DAY) * Math.PI * 2);
  }
}
