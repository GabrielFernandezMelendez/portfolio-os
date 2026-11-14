// Pincel y vertidos (ajustables en la ronda de pulido)

/** Segundos (reales) que tarda en caer ~63 % del máximo sobre la misma zona: rendimiento decreciente */
export const POUR_DWELL_SECONDS = 1;

/** Máximo por celda en un trazo (niveles): Duna y el resto de arenas con masa */
export const POUR_MAX_DUNE = 1.5;
export const POUR_MAX_MASS = 1;
/** Las arenas sin masa (Despertar, Afinidad) cuentan "intensidad" 0..1 por celda */
export const POUR_MAX_MASSLESS = 1;

/** Cantidad total que puede verter un trazo (suma de todas sus celdas) */
export const STROKE_TOTAL_CAP = 20;

/** Duración de un vertido: de MIN a MAX días de juego (opción B), al azar */
export const POUR_DAYS_MIN = 1;
export const POUR_DAYS_MAX = 2;

/** Al sumar arena a un vertido pendiente, su duración se alarga esta fracción de lo añadido */
export const POUR_MERGE_EXTENSION = 0.5;

/** Banda (px de pantalla) junto al borde que desliza la cámara mientras se vierte */
export const POUR_EDGE_BAND = 40;

/** La capa sin asentar se vuelve a dibujar cada este número de minutos de juego */
export const PENDING_REDRAW_MINUTES = 10;
/**
 * Arenas de capa (Duna, Humus, Brasa): el suelo cambia de color (de material) cuando el vertido lleva
 * esta parte asentada. Antes solo se ven los granos sin asentar encima; así no hay saltos de color.
 */
export const LAYER_SWITCH_PROGRESS = 0.5;

/** Un toque corto (sin arrastrar) vierte como si el dedo hubiera estado este tiempo encima */
export const POUR_TAP_SECONDS = 0.15;
