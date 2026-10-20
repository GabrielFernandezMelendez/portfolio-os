// Nombres de los animales [PROPUESTA]: irónicos. Se afinan en la fase de pulido.
// Por especie: nombres "de persona" por sexo y nombres de comida (los de su planta favorita o la de su madre).
// Son nombres propios: no se traducen.

export interface NamePool {
  readonly male: readonly string[];
  readonly female: readonly string[];
  /** Por clave de planta: nombres que salen de esa comida */
  readonly food: Readonly<Record<string, readonly string[]>>;
}

export const ANIMAL_NAMES: Readonly<Record<string, NamePool>> = {
  deer: {
    male: ['Carlos', 'Paco', 'Don Ramiro', 'Kevin', 'Sr. Brote', 'Tupé', 'Julián', 'Manolo', 'Ernesto', 'Bambi Jr.'],
    female: ['Bruma', 'Mari Trini', 'Lola', 'Doña Paz', 'Vanesa', 'Rocío', 'Encarna', 'Brenda', 'Sole'],
    food: {
      grass: ['Hierbajo', 'Césped'],
      clover: ['Trébol', 'Cuatro Hojas'],
      oak: ['Bellota', 'Bellotita'],
      appleTree: ['Manzana', 'Compota'],
      redBerries: ['Baya', 'Mermelada'],
      blueberry: ['Arándano'],
      vine: ['Parra'],
      willow: ['Sauce'],
    },
  },
};

/** Probabilidad de que una cría se llame como la comida favorita de su madre (o la suya) */
export const FOOD_NAME_CHANCE = 0.35;
