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
  // Conejos: nombres de tipo duro para el animal más asustadizo de la isla (y muchos: crían sin parar)
  rabbit: {
    male: ['Rambo', 'Conan', 'Sansón', 'Hércules', 'Goliat', 'Brutus', 'El Toro', 'Fermín', 'Gregorio', 'Duque', 'Toñito', 'Bigotes', 'Pancho', 'Lucifer'],
    female: ['Pelusa', 'Doña Orejas', 'Maripili', 'Reme', 'Cuqui', 'Puri', 'Chelo', 'Amparo', 'Tata', 'Fina', 'Nieves', 'Conchi', 'Feli', 'Loli'],
    food: {
      grass: ['Brizna', 'Hierbajo'],
      clover: ['Trébol', 'Suerte'],
      sage: ['Salvia'],
      thistle: ['Cardo', 'Pincho'],
      bramble: ['Zarza'],
      glowFlower: ['Lucecita'],
      rockMoss: ['Musgo'],
      reed: ['Junco'],
    },
  },
  // Lobos: nombres tiernos para el depredador de la isla (y alguno por la comida favorita de su madre)
  wolf: {
    male: ['Peluchín', 'Algodón', 'Copito', 'Bizcocho', 'Mimoso', 'Don Abrazos', 'Pompón', 'Ricitos', 'Caramelo', 'Gominola'],
    female: ['Dulcinea', 'Princesa', 'Florecilla', 'Miel', 'Nube', 'Azucena', 'Bombón', 'Galletita', 'Margarita'],
    food: {
      redBerries: ['Mermelada'],
      blueberry: ['Arándano'],
      shadeBerries: ['Bayita'],
    },
  },
  // Cuervos: nombres de sabio, de detective y de mal agüero (son los listos de la isla)
  crow: {
    male: ['Edgar', 'Sócrates', 'Don Nevermore', 'Sherlock', 'Profesor', 'Merlín', 'Baltasar', 'Notario', 'Agorero', 'Hugo'],
    female: ['Morgana', 'Casandra', 'Doña Urraca', 'Agatha', 'Sibila', 'Medianoche', 'Tinta', 'Brígida', 'Viuda Negra'],
    food: {
      redBerries: ['Mermelada'],
      blueberry: ['Arándano'],
      appleTree: ['Pepita'],
      oak: ['Bellota'],
    },
  },
  // Humanos: nombres de oficina, de móvil y de cuñado, para la especie que cree que manda
  human: {
    male: ['Jonathan', 'Brayan', 'Kevin Costa', 'Mánager', 'Coach', 'Iván', 'Dani', 'Influencer', 'Paco Wifi', 'El Primo', 'Borja'],
    female: ['Jessica', 'Vanessa', 'Yeni', 'Tamara', 'Coach Mari', 'Soraya', 'Paula', 'Cristina', 'Lorena', 'Desirée', 'Marisa'],
    food: {
      redBerries: ['Baya'],
      blueberry: ['Arándano'],
      appleTree: ['Manzana'],
      oak: ['Bellota'],
    },
  },
  // Goblins: nombres de ruido y de mascota, para las criaturas más horribles de la isla
  goblin: {
    male: ['Gorgo', 'Ñak', 'Bluk', 'Snik', 'Grumo', 'Mocoso', 'Pupas', 'Garrapato', 'Tizón', 'Chispa'],
    female: ['Grisa', 'Ñaka', 'Verruga', 'Cenicienta', 'Mugre', 'Brasita', 'Hollín', 'Pústula', 'Tiznada'],
    food: {},
  },
};

/** Probabilidad de que una cría se llame como la comida favorita de su madre (o la suya) */
export const FOOD_NAME_CHANCE = 0.35;
