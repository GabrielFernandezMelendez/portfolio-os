// Herramientas de desarrollo visibles en el juego (ponlo a false antes de publicar una versión final)

/** Botones de prueba en Ajustes. Se quitan (o se dejan en false) antes de publicar. */
export const DEV_TOOLS = true;

/**
 * Botones de prueba de Ajustes, en orden. Añadir uno = una entrada aquí, su texto en i18n (settings.dev.<id>)
 * y su caso en SandworldService.runDevAction.
 */
export const DEV_ACTIONS = [
  'reveal',        // descubrir el siguiente chunk (fase 7: expansión real)
  'sandPile',      // montón de arena en un sitio al azar (desprendimientos)
  'spring',        // manantial en una cumbre o ladera al azar
  'rain',          // que llueva ahora (o nieve, si hace frío)
  'nextSeason',    // saltar a la estación siguiente
  'glade',         // despertar un Claro sin sorteo
  'viewValues',    // ver esencia y afinidad de cada tile
  'viewBiomes',    // ver el bioma de cada tile
  'viewSenses',    // ver hasta dónde ve cada animal (de lejos, cada manada) y sus distancias de alerta y huida
  'discoverPlants', // conocer todas las plantas (sus nombres al tocarlas)
  'garden',        // sembrar un huerto en un sitio llano al azar (como lo hará una especie evolucionada)
  'fruitAllYear',  // ver el fruto todo el año (sin esperar a su temporada)
  'eatFruit',      // comerse el fruto de todas las plantas (como lo harán los animales)
  'storm',         // tormenta eléctrica ahora
  'dryStorm',      // tormenta seca ahora (la que provoca incendios)
  'ignite',        // prender fuego en un sitio con vegetación al azar
  'burntLand',     // Tierra Quemada de 3 × 3 tiles en un sitio al azar
  'drainLife',     // la Tierra Quemada se queda sin vida (empieza a remitir)
  'deerHerd',      // soltar una manada de ciervos en un sitio al azar
  'overpopulate',  // soltar 6 manadas de ciervos a la vez (sobrepoblación)
  'ageAnimals',    // todos los animales cumplen 30 días de golpe
  'rabbitColony',  // soltar una colonia de conejos con su madriguera ya cavada
  'rabbitBoom',    // soltar 6 colonias de conejos a la vez (superpoblación: hambre y enfermedad)
  'rabbitLitter',  // las conejas adultas paren dentro de una hora (camadas de 2 a 7)
  'rabbitOutbreak', // brota la enfermedad ahora en la colonia más grande
  'findBurrow',    // llevar la cámara a una madriguera (para probar la Marea, la Duna o el agua encima)
  'wolfPack',      // soltar una manada de lobos con su cueva
  'crowPair',      // soltar una pareja de cuervos (con jóvenes) y su nido
  'humanBand',     // soltar una banda de humanos con su choza
  'goblinNest',    // Tierra Quemada con un nido de goblins ya nacido
] as const;

export type DevAction = (typeof DEV_ACTIONS)[number];
