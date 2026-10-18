// Dimensiones del mundo: forman parte del modelo (los arrays de un chunk dependen de ellas).

export const WORLD = {
  /** Tiles por lado de un chunk (rejilla ecológica: clima, bioma, poblaciones) */
  TILES: 8,
  /** Celdas por lado de un tile (rejilla física: altura, materiales, agua) */
  CELLS_PER_TILE: 4,
  /** Celdas por lado de un chunk (TILES × CELLS_PER_TILE) */
  CELLS: 32,

  /** Tamaño de un tile en píxeles de arte (rombo isométrico 2:1) */
  TILE_W: 40,
  TILE_H: 20,

  /** Píxeles que sube cada nivel de altura (terrazas) */
  LEVEL_PX: 5,
  /** Niveles de altura: 0..MAX_LEVEL */
  MAX_LEVEL: 7,
  /** Grosor del acantilado bajo el nivel 0 en el borde de la isla */
  BASE_DEPTH: 10,
} as const;
