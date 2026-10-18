// Agua (ajustable en la ronda de pulido). Unidades: niveles de altura y minutos de juego.

/**
 * Pasadas de flujo por minuto de juego (0,5 = una cada 2 minutos). En cada pasada el agua avanza como mucho una celda:
 * marca la velocidad máxima de un río (a x1, unas 2 celdas por segundo real).
 */
export const WATER_PASSES_PER_MINUTE = 0.5;

/**
 * Caudal que gana una "tubería" hacia una vecina por cada nivel de desnivel de superficie, por pasada
 * (×flow del material). Junto con la inercia marca cuánta agua lleva un río. Como en cada pasada sale como mucho
 * la mitad del agua de una celda, el agua no rebota entre celdas aunque el caudal sea alto.
 */
export const PIPE_RATE = 0.2;

/** Parte del caudal de la pasada anterior que se conserva (inercia: el agua que corre sigue corriendo) */
export const PIPE_INERTIA = 0.4;

/** Lámina mínima que se considera agua (por debajo se seca) */
export const WATER_MIN = 0.003;

/** Fracción del agua de una celda de borde que cae al mar de nubes en cada pasada */
export const EDGE_DRAIN_RATE = 0.16;

/** Evaporación por minuto, multiplicada por la temperatura del tile (0..1) */
export const EVAPORATION = 0.0003;

/** Infiltración por minuto, multiplicada por la permeabilidad del material */
export const INFILTRATION = 0.0015;

/**
 * Frente de mojado: agua (en niveles) que empapa una celda seca antes de dejar pasar el resto,
 * multiplicada por min(1, permeabilidad × 4): mucho en arena, bastante en tierra, nada en roca o suelo calcinado.
 * Es lo que frena el avance de un río nuevo: ≈ 15 h de juego por chunk sobre tierra seca (≈ 4 min reales a x1,
 * 1 min a x4) y ≈ 2 h sobre roca.
 */
export const WETTING_DEPTH = 0.2;

/** Agua (en niveles) que cabe en el suelo de una celda cuando la humedad es 1 */
export const SOIL_WATER_CAPACITY = 0.1;

/** Secado del suelo por minuto, multiplicado por (1 - retención) y por el calor */
export const SOIL_DRYING = 0.0006;

/** Aporte del nivel freático por minuto a las celdas por debajo de él (mantiene los lagos) */
export const WATER_TABLE_RECHARGE = 0.004;

/** Caudal que sale de una celda (por minuto) por debajo del cual el agua se considera quieta */
export const STAGNANT_FLOW = 0.002;

/** Manantiales naturales: caudal (niveles/minuto) y altura mínima del terreno para aparecer */
export const NATURAL_SPRING_RATE = 0.03;
export const NATURAL_SPRING_MIN_LEVEL = 4;

/** Las reglas de transformación (barro, secado...) se revisan cada este número de minutos */
export const RULE_INTERVAL_MINUTES = 10;

/** Cambio de agua (en niveles) que se nota al dibujar: por debajo no se vuelve a hornear */
export const WATER_VISUAL_STEP = 0.008;
