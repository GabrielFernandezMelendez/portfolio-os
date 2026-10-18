// Física del terreno (ajustable en la ronda de pulido)

/** Pasadas de desprendimientos por cada minuto de juego (más = el terreno se asienta antes) */
export const LANDSLIDE_PASSES_PER_MINUTE = 1;

/** Celdas activas que se procesan como mucho en cada pasada (protege el rendimiento en móvil) */
export const LANDSLIDE_MAX_CELLS = 900;

/**
 * Fracción del exceso sobre el talud que se mueve a cada vecino en una pasada.
 * Con 4 vecinos y ≤ 0,25 nunca se invierte la pendiente; 0,15 deja ver cómo resbala la arena.
 */
export const LANDSLIDE_RATE = 0.15;

/** Exceso mínimo (en niveles) para mover material: por debajo se considera estable */
export const LANDSLIDE_EPSILON = 0.01;

/** Altura máxima del terreno (en niveles): por encima no se acumula más */
export const MAX_GROUND = 7.9;

/** Re-horneado de un chunk como mucho cada este tiempo (ms reales) mientras cambia */
export const REBAKE_INTERVAL_MS = 120;
