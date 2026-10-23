import { Diet } from '../models/plant.model';
import { MaterialId } from '../models/material.model';
import { SeasonId } from '../models/time.model';
import { RandomSource } from './random-source.port';

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
  /** ¿Se puede pisar? (`burnt`: también el suelo calcinado de la Tierra Quemada, para los que viven en ella) */
  walkable(gx: number, gy: number, burnt?: boolean): boolean;
  /** Altura del suelo (para no subir de golpe una terraza alta) */
  height(gx: number, gy: number): number;
  /** Comida que hay en el tile de esta celda para estas dietas, sin contar las plantas que evita */
  foodAt(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, now: number, season: SeasonId): number;
  /** Come hasta `want` de comida del tile de esta celda (prefiere `favourite`); null si no hay nada */
  eat(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, want: number, favourite: number, now: number, season: SeasonId): Meal | null;
  /** Celda pisable junto al agua más cercana, a `max` celdas como mucho (null si no hay) */
  /** El agua más cercana (hasta `max` celdas), saltándose las celdas que `skip` descarte (p. ej. agua a la que no llega) */
  nearestWater(gx: number, gy: number, max: number, skip?: (x: number, y: number) => boolean): { readonly x: number; readonly y: number; readonly distance: number } | null;
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
  /** Material del suelo de una celda (para saber si se puede cavar) o null si no hay isla */
  materialAt(gx: number, gy: number): MaterialId | null;
  /** ¿Hay agua de verdad en la celda (no se pisa)? (madrigueras inundadas) */
  flooded(gx: number, gy: number): boolean;
  /** Comida de toda la isla para estas dietas (para la capacidad de cada especie) */
  totalFood(diets: readonly Diet[], now: number, season: SeasonId): number;
  /**
   * Superficie descubierta de la isla, en parcelas (config/island.config.ts), para saber cuántos grupos caben: los
   * topes "por chunk" de las especies se cuentan por parcela
   */
  islandArea(): number;
  /** Una celda pisable junto a la orilla de la isla (por donde llegan y se van los animales), o null */
  shore(random: RandomSource): { readonly x: number; readonly y: number } | null;
  /** ¿Está helado el tile? (la Escarcha) */
  frozenAt(gx: number, gy: number): boolean;
  /**
   * Temperatura que siente un animal en una celda (escala 0..1 del mundo: ~0,2 es helar, ~0,5 templado, ~0,8 calor):
   * la del clima y, encima o al lado de la Tierra Quemada viva, su calor.
   */
  temperature(gx: number, gy: number): number;
  /** Lo que comen los goblins alimenta el suelo quemado donde viven (crece más deprisa) */
  feedBurnt(gx: number, gy: number, amount: number): void;
}
