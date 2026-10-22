/*
  Reparto por chunks de una revisión periódica: en vez de revisar todos los chunks a la vez (un pico en el minuto en
  punto), cada uno se revisa en su minuto dentro del periodo. Cada chunk se sigue revisando una vez por periodo y
  con el mismo tiempo transcurrido; solo cambia en qué minuto (como mucho, `every` - 1 minutos de diferencia).
*/

export interface ChunkSlot {
  /** Minuto de juego (dentro del periodo) que se está revisando */
  readonly minute: number;
  /** Minutos del periodo (p. ej. 60: cada hora) */
  readonly every: number;
}

/** ¿Le toca al chunk número `index` (de `count`) en este minuto? */
export function inSlot(index: number, count: number, slot: ChunkSlot): boolean {
  return Math.floor((index * slot.every) / Math.max(1, count)) === slot.minute % slot.every;
}
