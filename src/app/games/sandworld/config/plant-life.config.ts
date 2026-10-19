// Ciclo de vida visible de cada planta [PROPUESTA]: valores de partida, se afinan en la fase de pulido.

import { PlantKind } from '../domain/models/plant.model';

/**
 * Edad (días de juego) a la que una planta silvestre pasa de semilla a brote, de brote a joven y de joven a adulta.
 * Una planta nueva nunca aparece ya adulta: va creciendo por etapas.
 */
export const STAGE_DAYS: Readonly<Record<PlantKind, readonly [sprout: number, young: number, adult: number]>> = {
  small: [0.25, 1, 2],
  bush: [0.5, 2, 5],
  tree: [1, 4, 10],
};

/**
 * Margen para que nazca o muera una planta (en "plantas" de biomasa × sprites).
 * Nace una nueva solo cuando a la vegetación del tile le sobra BIRTH_MARGIN de planta; muere una solo cuando
 * le falta DEATH_MARGIN. Así una biomasa que oscila justo en el límite no hace morir y renacer plantas.
 */
export const BIRTH_MARGIN = 0.6;
export const DEATH_MARGIN = 0.6;

/**
 * Días que aguanta una planta con agua honda en su celda antes de ahogarse. Si el agua baja antes, se recupera.
 * Mientras tanto se ve sufriendo. Las de orilla (junco, sauce) aguantan SHORE_DROWN_FACTOR veces más.
 */
export const DROWN_DAYS: Readonly<Record<PlantKind, number>> = { small: 0.5, bush: 1, tree: 2 };
export const SHORE_DROWN_FACTOR = 2;

/** Días que se quedan los restos: tocón de un árbol, tronco caído, mata seca de un arbusto y árbol carbonizado */
export const REMAINS_DAYS = { stump: 6, log: 3, dryBush: 2, snag: 8 } as const;

/** Fruto: días que tarda en volver del todo tras comérselo y en madurar al empezar su temporada */
export const FRUIT_REGROW_DAYS = 4;
export const FRUIT_RIPEN_DAYS = 3;

/** Duración de las animaciones (ms reales) */
export const PLANT_ANIM_MS = {
  pop: 450,       // nace: destello y semilla que asoma
  bounce: 260,    // salto de 1 píxel al cambiar de etapa
  fall: 900,      // árbol que cae
  sink: 1600,     // se hunde en el agua
  bury: 1600,     // la arena la cubre
  wither: 1800,   // se seca del todo
  dissolve: 700,  // se deshace en polvo
} as const;
