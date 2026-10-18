import { CALENDAR } from '../../domain/models/time.model';
import { clamp, smooth } from '../world/noise';

const HALF = CALENDAR.TRANSITION / 2;
const NOON = 12 * 60;

/** Cuánta luz hay (0 noche cerrada, 1 pleno día) en un minuto del día con decimales */
export function lightLevel(minuteOfDay: number): number {
  const m = minuteOfDay;
  if (m < NOON) return smooth(clamp((m - (CALENDAR.DAWN - HALF)) / CALENDAR.TRANSITION));
  return 1 - smooth(clamp((m - (CALENDAR.DUSK - HALF)) / CALENDAR.TRANSITION));
}

/** Calidez del amanecer o atardecer (0..1): máxima en el centro de cada transición */
export function twilight(minuteOfDay: number): number {
  const bump = (center: number): number => {
    const d = Math.abs(minuteOfDay - center) / (CALENDAR.TRANSITION * 0.5);   // calidez solo en la mitad central
    return d >= 1 ? 0 : smooth(1 - d);
  };
  return Math.max(bump(CALENDAR.DAWN), bump(CALENDAR.DUSK));
}
