// Fuego y Tierra Quemada (fase 4, bloque B) [PROPUESTA]: valores de partida para afinar jugando.

/** Cada cuántos minutos de juego se revisa el fuego */
export const FIRE_CHECK_MINUTES = 10;

// ── Sequedad ──
/** Cuánto cambia cada estación la sequedad de un tile (factor 1 + esto): primavera, verano, otoño, invierno */
export const SEASON_DRYNESS = [-0.1, 0.15, 0, -0.35] as const;
/** Sequedad extra en sequía, también como factor (y lo que tarda en notarse del todo, en días sin llover) */
export const DROUGHT_DRYNESS = 0.25;
export const DROUGHT_FULL_DAYS = 10;
/** Mientras llueve, la sequedad se multiplica por esto */
export const RAIN_DRYNESS = 0.1;

// ── Encender y propagar ──
/** Combustible × sequedad mínimo para que un tile prenda (por un rayo, la Brasa o un vecino en llamas) */
export const IGNITE_MIN = 0.12;
/** Calor acumulado de la Brasa a partir del cual prende la vegetación seca (un trazo da como mucho 1: prende a medio asentar) */
export const BRASA_IGNITE_HEAT = 0.3;
/** Días que tarda en arder un tile entero con combustible 0 (se alarga con más combustible) */
export const BURN_DAYS = 0.25;
/** Probabilidad por día de prender a cada vecina, con intensidad 1 y una vecina llena de combustible seco */
export const SPREAD_PER_DAY = 10;
/** Parte del tile que tiene que haber ardido para que el fuego salte a las vecinas */
export const SPREAD_FROM_AGE = 0.35;
/** Lo que apaga la lluvia: intensidad por día con lluvia de intensidad 1 */
export const RAIN_DOUSE_PER_DAY = 8;
/** Nieve o hielo (niveles de media en el tile) que impide arder: lo que deja la Escarcha */
export const FIRE_STOP_COVER = 0.15;
/** Ceniza que queda: el suelo chamuscado se va en estos días; y fertilidad que suma al tile al arder */
export const SCORCH_DAYS = 12;
export const ASH_FERTILITY = 0.15;

// ── Tierra Quemada ──
/** Tiles quemados y unidos que hacen falta para que nazca la Tierra Quemada */
export const BURNT_LAND_TILES = 9;
/** Días que un tile quemado cuenta para juntar esos 9 (un incendio largo los va sumando) */
export const BURNED_MEMORY_DAYS = 3;
/**
 * Probabilidad por día de que un tile del borde prenda a cada vecina seca, por estación
 * (≈ un tile nuevo cada 3–5 días en verano en cada frente; casi nada en invierno)
 */
export const BURNT_SPREAD_PER_DAY = [0.04, 0.08, 0.05, 0.004] as const;
/** Humus o Brasa sobre la Tierra Quemada: alimento que suma por unidad y cuánto multiplica su crecimiento */
export const BURNT_FEED_PER_UNIT = 0.5;
export const BURNT_FEED_BOOST = 3;
/** El alimento se gasta en estos días */
export const BURNT_FEED_DAYS = 5;
/** Desvío de temperatura del tile (Escarcha) por debajo del cual la Tierra Quemada no crece por ese borde */
export const BURNT_FROZEN_SHIFT = -0.1;

// ── Remisión (cuando ya no tiene vida) ──
/** Días hasta que vuelve el primer anillo (el borde) y días más por cada anillo hacia dentro; más un azar de hasta JITTER */
export const REMIT_START_DAYS = 4;
export const REMIT_RING_DAYS = 6;
export const REMIT_JITTER_DAYS = 3;
/** Fertilidad que suma al volver (la ceniza es muy fértil) y hierba con la que arranca */
export const REMIT_FERTILITY = 0.3;
export const REMIT_GRASS = 0.4;

// ── Tormenta eléctrica ──
/** Rayos por hora con una tormenta de intensidad 1 */
export const LIGHTNING_PER_HOUR = 3;
/** Tiles que mira cada rayo para elegir dónde cae (prefiere los árboles altos y lo seco) */
export const LIGHTNING_CANDIDATES = 12;
