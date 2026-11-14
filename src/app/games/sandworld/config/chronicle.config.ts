// Ritmo de la crónica (análisis funcional §11)

/** Cada cuánto sale un mensaje de la cola hacia la franja: 30 s → como mucho 2 nuevos por minuto real */
export const CHRONICLE_RELEASE_MS = 30_000;

/** Mensajes que guarda el libro (todos, al momento y en orden de tiempo de juego; la cola no le afecta) */
export const CHRONICLE_HISTORY = 100;

/** Mensajes en espera para la franja como máximo; si se llena, la franja se salta los de menor prioridad (el libro los guarda igual) */
export const CHRONICLE_QUEUE_MAX = 20;

/** La franja rota los últimos N mensajes, cada uno durante ROTATE_MS */
export const CHRONICLE_STRIP_COUNT = 4;
export const CHRONICLE_ROTATE_MS = 6_000;
