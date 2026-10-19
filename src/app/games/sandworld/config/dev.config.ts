// Herramientas de desarrollo visibles en el juego (ponlo a false antes de publicar una versión final)

/** Botones de prueba en Ajustes. Se quitan (o se dejan en false) antes de publicar. */
export const DEV_TOOLS = true;

/**
 * Botones de prueba de Ajustes, en orden. Añadir uno = una entrada aquí, su texto en i18n (settings.dev.<id>)
 * y su caso en SandworldService.runDevAction.
 */
export const DEV_ACTIONS = [
  'reveal',        // descubrir el siguiente chunk (fase 7: expansión real)
  'sandPile',      // montón de arena (desprendimientos)
  'spring',        // manantial en la cumbre
  'rain',          // que llueva ahora (o nieve, si hace frío)
  'nextSeason',    // saltar a la estación siguiente
  'glade',         // despertar un Claro sin sorteo
  'viewValues',    // ver esencia y afinidad de cada tile
  'viewBiomes',    // ver el bioma de cada tile
  'discoverPlants', // conocer todas las plantas (sus nombres al tocarlas)
  'garden',        // sembrar un huerto (como lo hará una especie evolucionada)
  'fruitAllYear',  // ver el fruto todo el año (sin esperar a su temporada)
  'eatFruit',      // comerse el fruto de todas las plantas (como lo harán los animales)
] as const;

export type DevAction = (typeof DEV_ACTIONS)[number];
