// Ritmo de la crónica (análisis funcional §11)

/** Cada cuánto sale un mensaje de la cola: 30 s → como mucho 2 nuevos por minuto real */
export const CHRONICLE_RELEASE_MS = 30_000;

/** Mensajes que guarda el libro */
export const CHRONICLE_HISTORY = 100;

/** Mensajes en espera como máximo; si se llena, se descartan los de menor prioridad */
export const CHRONICLE_QUEUE_MAX = 20;

/** La franja rota los últimos N mensajes, cada uno durante ROTATE_MS */
export const CHRONICLE_STRIP_COUNT = 4;
export const CHRONICLE_ROTATE_MS = 6_000;
