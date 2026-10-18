// Ritmo del tiempo real frente al tiempo de juego (ajustable en la ronda de pulido)

/** Segundos reales que dura un día de juego a velocidad x1 (6 min) */
export const REAL_SECONDS_PER_DAY = 360;

/** Hora a la que empieza una partida nueva: día 1, 09:00 (recién terminado el amanecer) */
export const START_MINUTE = 9 * 60;

/** Un frame nunca avanza más de esto: al volver de otra pestaña no hay saltos bruscos */
export const MAX_FRAME_MS = 250;
