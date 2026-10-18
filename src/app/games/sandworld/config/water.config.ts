// Agua (ajustable en la ronda de pulido). Unidades: niveles de altura y minutos de juego.

/** Pasadas de flujo por minuto de juego */
export const WATER_PASSES_PER_MINUTE = 2;

/** Fracción del desnivel de superficie que pasa a cada vecina por pasada (×flow del material; ≤ 0,25 es estable) */
export const WATER_FLOW_RATE = 0.12;

/** Lámina mínima que se considera agua (por debajo se seca) */
export const WATER_MIN = 0.003;

/** Fracción del agua de una celda de borde que cae al mar de nubes en cada pasada */
export const EDGE_DRAIN_RATE = 0.08;

/** Evaporación por minuto, multiplicada por la temperatura del tile (0..1) */
export const EVAPORATION = 0.00015;

/** Infiltración por minuto, multiplicada por la permeabilidad del material */
export const INFILTRATION = 0.0015;

/**
 * Frente de mojado: agua (en niveles) que empapa una celda seca antes de dejar pasar el resto,
 * multiplicada por min(1, permeabilidad × 4): mucho en arena, bastante en tierra, nada en roca o suelo calcinado.
 * Es lo que frena el avance de un río nuevo (≈ 1,5 h de juego por chunk con un manantial normal).
 */
export const WETTING_DEPTH = 0.28;

/** Agua (en niveles) que cabe en el suelo de una celda cuando la humedad es 1 */
export const SOIL_WATER_CAPACITY = 0.1;

/** Secado del suelo por minuto, multiplicado por (1 - retención) y por el calor */
export const SOIL_DRYING = 0.0006;

/** Aporte del nivel freático por minuto a las celdas por debajo de él (mantiene los lagos) */
export const WATER_TABLE_RECHARGE = 0.004;

/** Caudal que sale de una celda (por minuto) por debajo del cual el agua se considera quieta */
export const STAGNANT_FLOW = 0.002;

/** Manantiales naturales: caudal (niveles/minuto) y altura mínima del terreno para aparecer */
export const NATURAL_SPRING_RATE = 0.06;
export const NATURAL_SPRING_MIN_LEVEL = 4;

/** Las reglas de transformación (barro, secado...) se revisan cada este número de minutos */
export const RULE_INTERVAL_MINUTES = 10;

/** Cambio de agua (en niveles) que se nota al dibujar: por debajo no se vuelve a hornear */
export const WATER_VISUAL_STEP = 0.025;
