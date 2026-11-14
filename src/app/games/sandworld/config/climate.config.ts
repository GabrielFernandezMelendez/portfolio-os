import { Biome } from '../domain/models/biome.model';
// Clima y estaciones (fase 3, bloque C) [PROPUESTA]: valores de partida para afinar jugando.

// ── Temperatura ──
/** Desvío de temperatura de cada estación (primavera, verano, otoño, invierno) sobre el clima base del tile */
export const SEASON_TEMPERATURE = [0, 0.15, -0.05, -0.25] as const;
/** Días al final de cada estación en los que la temperatura va pasando a la de la siguiente */
export const SEASON_BLEND_DAYS = 5;
/** Oscilación entre el día y la noche (la tarde es lo más cálido y la madrugada lo más frío) */
export const DAILY_TEMPERATURE_SWING = 0.05;
export const WARMEST_MINUTE = 14 * 60;

// ── Lluvia y nieve ── (cuántas veces y cuánto dura cada fenómeno: config/weather.config.ts)
/** Agua que cae por minuto y celda con intensidad 1 (primero empapa el suelo, luego corre) */
export const RAIN_RATE = 0.0004;
/** Por debajo de esta temperatura efectiva, en vez de llover nieva */
export const SNOW_TEMPERATURE = 0.3;
/** Nieve que deja cada nivel de agua de lluvia (la nieve abulta más) */
export const SNOW_PER_RAIN = 2;

// ── Frío del invierno por altura y bioma ──
/**
 * El frío de la estación (invierno, final del otoño) no llega igual a toda la isla: nada por debajo de este
 * cuantil de altura de la isla (la mitad más baja) y todo desde WINTER_COLD_FULL (lo más alto). Así en invierno
 * siempre queda tierra sin nieve y agua líquida en las partes bajas.
 */
export const WINTER_COLD_FROM = 0.5;
export const WINTER_COLD_FULL = 0.9;
/** Biomas con el frío fijo, sea cual sea su altura: el desierto nunca se hiela; la tundra, siempre */
export const WINTER_COLD_BY_BIOME: Readonly<Partial<Record<number, number>>> = {
  [Biome.DESERT]: 0,
  [Biome.TUNDRA]: 1,
};

// ── Hielo de invierno ──
/** Por debajo de esta temperatura efectiva el agua se congela */
export const FREEZE_TEMPERATURE = 0.2;
/** Agua que se congela por minuto y por grado por debajo de FREEZE_TEMPERATURE */
export const FREEZE_RATE = 0.002;

// ── Sequía ──
/** Días de verano sin lluvia a partir de los que la crónica avisa de sequía */
export const DROUGHT_DAYS = 12;
