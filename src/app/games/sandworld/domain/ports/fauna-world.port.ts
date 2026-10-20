import { Diet } from '../models/plant.model';
import { SeasonId } from '../models/time.model';

/** Lo que se ha comido un animal de una vez */
export interface Meal {
  /** Comida (biomasa × nutrición) */
  readonly food: number;
  /** Planta (id del registro) */
  readonly plant: number;
  /** Era fruto (deja semillas) o pasto u hojas */
  readonly fruit: boolean;
}

/**
 * Puerto de la fauna hacia el mundo: lo único que la simulación de animales sabe del terreno y la vegetación.
 * Así la fauna no depende de cómo se guardan los chunks, y los tests le dan un mundo de mentira.
 * Coordenadas en celdas globales.
 */
export interface FaunaWorld {
  /** ¿Puede pisar esta celda? (descubierta, sin agua honda, sin Tierra Quemada) */
  walkable(gx: number, gy: number): boolean;
  /** Altura del suelo (para no subir de golpe una terraza alta) */
  height(gx: number, gy: number): number;
  /** Comida que hay en el tile de esta celda para estas dietas, sin contar las plantas que evita */
  foodAt(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, now: number, season: SeasonId): number;
  /** Come hasta `want` de comida del tile de esta celda (prefiere `favourite`); null si no hay nada */
  eat(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, want: number, favourite: number, now: number, season: SeasonId): Meal | null;
  /** Celda pisable junto al agua más cercana, a `max` celdas como mucho (null si no hay) */
  nearestWater(gx: number, gy: number, max: number): { readonly x: number; readonly y: number; readonly distance: number } | null;
  /** Peligro aquí (0..1): fuego en el tile o al lado. `from` dice de dónde viene (para huir al otro lado). */
  danger(gx: number, gy: number): { readonly level: number; readonly fromX: number; readonly fromY: number };
  /** Pisoteo: la vegetación pequeña del tile pierde esta parte (0..1); mucho pisoteo empobrece el suelo */
  trample(gx: number, gy: number, amount: number): void;
  /** Un animal deja una semilla de esta planta (puede germinar) */
  dropSeed(plant: number, gx: number, gy: number): void;
  /** Un cadáver abona el suelo */
  fertilize(gx: number, gy: number, amount: number): void;
  /** Refugio más cercano (bajo los árboles), a `max` celdas como mucho: para la lluvia, la tormenta, el frío o el calor */
  shelterNear(gx: number, gy: number, max: number): { readonly x: number; readonly y: number } | null;
  /** ¿Hay nieve o hielo bajo sus patas? (se duerme peor) */
  snowAt(gx: number, gy: number): boolean;
  /** Comida de toda la isla para estas dietas (para la capacidad de cada especie) */
  totalFood(diets: readonly Diet[], now: number, season: SeasonId): number;
}
