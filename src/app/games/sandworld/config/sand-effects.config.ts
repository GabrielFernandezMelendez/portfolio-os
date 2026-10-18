// Efectos de las arenas (bloque 4) [PROPUESTA]: valores de partida para afinar jugando.
// Las cantidades son por unidad de arena asentada (una celda recibe hasta 1 por trazo; Duna, hasta 1,5).

// ── Marea ──
/** Sedimento que excava por unidad (la roca solo la erosiona a ritmo de años: aquí no se toca) */
export const MAREA_DIG = 1.0;

// ── Manantial ──
/** Caudal (niveles/minuto) de un manantial nuevo y lo que suma cada unidad vertida; tope de caudal */
export const MANANTIAL_BASE_RATE = 0.01;
export const MANANTIAL_RATE_PER_UNIT = 0.001;
export const MANANTIAL_MAX_RATE = 0.04;
/** Distancia (celdas) a la que un vertido de Manantial refuerza un manantial existente en vez de crear otro */
export const MANANTIAL_MERGE_DISTANCE = 2;

// ── Humus ──
/** Humus depositado por unidad (es ligero: sube poco) y fertilidad que suma al tile */
export const HUMUS_DEPOSIT = 0.6;
export const HUMUS_FERTILITY = 0.04;
export const HUMUS_MOISTURE = 0.5;

// ── Brasa ──
/** Agua que evapora, humedad que seca y nieve o hielo que funde por unidad */
export const BRASA_EVAPORATE = 2.0;
export const BRASA_DRY = 3.0;
export const BRASA_MELT = 2.0;
/** Ceniza que deja por unidad (si el suelo no está calcinado) */
export const BRASA_ASH = 0.05;
/** Calor que suma por unidad; el calor se reduce a la mitad cada BRASA_HEAT_HALF_LIFE días */
export const BRASA_HEAT = 1.0;
export const BRASA_HEAT_HALF_LIFE = 2;
/** Calor acumulado a partir del cual el suelo se calcina (Tierra Quemada): un trazo da como mucho 1, hacen falta 2–3 seguidos */
export const CHAR_HEAT = 1.5;
/** Desvío de temperatura del tile por unidad vertida en él */
export const BRASA_WARM = 0.02;

// ── Escarcha ──
/** Nieve depositada por unidad y agua que congela por unidad */
export const ESCARCHA_SNOW = 0.5;
export const ESCARCHA_FREEZE = 3.0;
/** Desvío de temperatura del tile por unidad vertida en él */
export const ESCARCHA_CHILL = 0.03;

// ── Despertar y Afinidad ──
/** Esencia y afinidad que suma al tile cada unidad (un tile tiene 16 celdas) */
export const DESPERTAR_ESSENCE = 0.05;
export const AFINIDAD_AFFINITY = 0.05;

// ── Frío y calor ──
/** El desvío de temperatura de un tile se reduce a la mitad cada este número de días */
export const TEMP_SHIFT_HALF_LIFE = 2;
/** Fusión de la capa helada por minuto y por grado de temperatura por encima de THAW_TEMPERATURE */
export const THAW_RATE = 0.0006;
export const THAW_TEMPERATURE = 0.3;
/** Agua que da al fundirse cada nivel de nieve (el hielo da 1) */
export const SNOW_WATER = 0.5;

// ── Manantiales tapados ──
/** Un manantial queda tapado si el terreno sube este tanto por encima de donde nació (Duna, desprendimientos) */
export const SPRING_BURY_DEPTH = 0.6;
/** ...o si lo cubre esta capa de nieve o hielo (vuelve a manar al fundirse) */
export const SPRING_FREEZE_COVER = 0.15;
