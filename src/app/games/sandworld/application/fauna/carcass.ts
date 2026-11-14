import { Animal } from '../../domain/models/animal.model';
import { BONES_LEFT } from '../../config/fauna.config';

/*
  Cadáveres: cuánta carne se han comido y en qué estado quedan. Común a todas las especies:
  - 'fresh': casi entero.
  - 'eaten': comido en parte (se ven las costillas).
  - 'bones': solo quedan los restos pegados a los huesos (BONES_LEFT de lo que tenía): ya solo come el cuervo.
  - 'clean': huesos limpios (ni el cuervo saca nada) hasta que desaparece.
*/

export type CarcassState = 'fresh' | 'eaten' | 'bones' | 'clean';

/** Por debajo de esta carne, los huesos están limpios */
export const CLEAN_BONES = 0.005;
/** Parte comida a partir de la cual ya no está "fresco" */
const FRESH_UNTIL = 0.1;

/** Parte de la carne que se han comido (0 = entero, 1 = nada) */
export function eatenOf(c: Animal): number {
  return c.meatFull > 0 ? Math.min(1, Math.max(0, 1 - c.meat / c.meatFull)) : 0;
}

/** Carne que queda pegada a los huesos: a partir de aquí solo come quien pica los huesos (cuervo) */
export function bonesLeft(c: Animal): number {
  return c.meatFull * BONES_LEFT;
}

export function carcassState(c: Animal): CarcassState {
  if (c.meat <= CLEAN_BONES) return 'clean';
  if (c.meat <= bonesLeft(c)) return 'bones';
  return eatenOf(c) < FRESH_UNTIL ? 'fresh' : 'eaten';
}
