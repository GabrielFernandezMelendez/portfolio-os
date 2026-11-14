// Fenómenos del tiempo (lluvia, y en el futuro tormenta, ola de calor, niebla...).
// Cada uno se registra en config/weather.config.ts; el planificador y el dibujo no saben nada de cada uno.

import { SeasonId } from './time.model';

/** Qué se dibuja mientras dura (partículas sobre la pantalla) */
export type PrecipitationLook = 'none' | 'rain' | 'snow';

/** Lo que un fenómeno puede hacer en el mundo cada minuto (lo implementa la física) */
export interface WeatherEffects {
  /** Lluvia (o nieve donde hace frío): niveles de agua por celda en este minuto. Devuelve si nevó en la mayor parte. */
  precipitate(amount: number): boolean;
  /** Tormenta eléctrica: con esta probabilidad cae un rayo este minuto (y puede prender lo seco) */
  strike(chance: number): void;
}

export interface WeatherEventDef {
  /** Clave del fenómeno: textos (i18n weather.<key>, chronicle.weather.<key>.start/end) e icono */
  readonly key: string;
  /** Episodios por estación (al azar entre min y max, ambos incluidos), en el orden de Season */
  readonly episodes: Readonly<Record<SeasonId, readonly [min: number, max: number]>>;
  /** Duración de cada episodio, en horas de juego */
  readonly hours: readonly [min: number, max: number];
  /** Intensidad de cada episodio (0..1) */
  readonly intensity: readonly [min: number, max: number];
  /** Efecto de un minuto del episodio. Devuelve el aspecto que toca dibujar ahora (p. ej. nieve si hace frío). */
  apply(world: WeatherEffects, intensity: number): PrecipitationLook;
  /** Oscurece el cielo y el mundo (0..1, multiplicado por la intensidad) */
  readonly gloom: number;
  /** Cuenta para la sequía (un episodio de este fenómeno la rompe) */
  readonly breaksDrought: boolean;
}

/** El tiempo que hace ahora */
export interface WeatherState {
  /** Fenómeno activo, o null si está despejado */
  readonly key: string | null;
  readonly intensity: number;
  readonly look: PrecipitationLook;
  readonly gloom: number;
}

export const CLEAR_WEATHER: WeatherState = { key: null, intensity: 0, look: 'none', gloom: 0 };
