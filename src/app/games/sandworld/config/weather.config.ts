import { Season } from '../domain/models/time.model';
import { WeatherEventDef } from '../domain/models/weather.model';
import { RAIN_RATE } from './climate.config';

/*
  Registro de fenómenos del tiempo [PROPUESTA]: valores de partida para afinar jugando.
  Añadir uno (tormenta, ola de calor, niebla, granizo...) = una entrada aquí, sus textos en i18n
  (weather.<key>, chronicle.weather.<key>.start / .end) y su icono pixel. Si necesita un efecto nuevo
  en el mundo, se añade a WeatherEffects (la física lo implementa).
*/
export const WEATHER_EVENTS: readonly WeatherEventDef[] = [
  {
    // Lluvia: moja el suelo y llena ríos y lagos. Donde hace frío cae como nieve.
    key: 'rain',
    // Más en verano, menos en invierno (de 0 a 10 por estación)
    episodes: {
      [Season.SPRING]: [1, 7],
      [Season.SUMMER]: [3, 10],
      [Season.AUTUMN]: [1, 7],
      [Season.WINTER]: [0, 4],
    },
    hours: [2, 6],
    intensity: [0.4, 1],
    gloom: 0.35,
    breaksDrought: true,
    apply: (world, intensity) => (world.precipitate(RAIN_RATE * intensity) ? 'snow' : 'rain'),
  },
];
