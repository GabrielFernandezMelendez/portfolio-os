import { PlantDef } from '../../domain/models/plant.model';
import { CALENDAR, GameTime, Season } from '../../domain/models/time.model';
import { LEAF_CHANGE_DAYS, LEAF_CHANGE_STAGGER_DAYS } from '../../config/plants.config';
import { LOOK_STEPS } from './plant-sprites';

/** Aspecto de estación de una planta (cada valor 0..1, ya redondeado a pasos) */
export interface PlantLook {
  readonly autumn: number;
  readonly leaves: number;
  readonly dry: number;
  readonly snow: boolean;
}

const step = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * LOOK_STEPS) / LOOK_STEPS;

/**
 * Aspecto de estación de una planta en este momento. Cada planta empieza con un retraso propio (seed)
 * y tarda entre LEAF_CHANGE_DAYS días en cada cambio:
 * - principio de otoño:    las hojas se vuelven ocres poco a poco
 * - principio de invierno: los árboles de hoja caduca las pierden (y la hierba se seca)
 * - final de invierno:     rebrotan verdes (y la hierba reverdece), así la primavera empieza ya verde
 */
export function plantLook(p: PlantDef, seed: number, time: GameTime, snow: boolean): PlantLook {
  const day = time.dayOfSeason - 1 + time.minuteOfDay / 1440;
  const delay = seed * LEAF_CHANGE_STAGGER_DAYS;
  const length = LEAF_CHANGE_DAYS[0] + ((seed * 7919) % 1) * (LEAF_CHANGE_DAYS[1] - LEAF_CHANGE_DAYS[0]);
  const changes = p.autumn || p.deciduous;
  if (!changes) return { autumn: 0, leaves: 1, dry: 0, snow };
  let autumn = 0, leaves = 1, dry = 0;
  if (time.season === Season.AUTUMN) {
    autumn = progress(day, delay, length);
  } else if (time.season === Season.WINTER) {
    // Rebrote al final del invierno: termina antes de que empiece la primavera
    const regrowStart = CALENDAR.DAYS_PER_SEASON - LEAF_CHANGE_DAYS[1] - LEAF_CHANGE_STAGGER_DAYS + delay;
    const fall = progress(day, delay, length);
    const regrow = progress(day, regrowStart, length);
    autumn = 1 - regrow;
    leaves = p.deciduous ? Math.max(1 - fall, regrow) : 1;
    dry = !p.deciduous ? fall * (1 - regrow) : 0;
  }
  return { autumn: step(autumn), leaves: step(leaves), dry: step(dry), snow };
}

/** 0 antes de `start`, 1 después de `start + length`, y en medio va subiendo */
function progress(day: number, start: number, length: number): number {
  return Math.max(0, Math.min(1, (day - start) / length));
}
