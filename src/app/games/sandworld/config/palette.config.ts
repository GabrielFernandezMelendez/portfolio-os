// Paleta del juego. Colores como número 0xRRGGBB (formato que usa PixiJS y el horneado del terreno).

export const SKY = {
  day:   0x8fd0f0,
  dusk:  0xf79a62,
  night: 0x1c2342,
} as const;

/** Tinte que se aplica al mundo de noche */
export const NIGHT_TINT = 0x5a66a8;

/** Tinte cálido del amanecer y el atardecer */
export const DUSK_TINT = 0xffb27a;

/**
 * Rampas de 5 tonos (oscuro → claro) para la cara superior del terreno.
 * El tramado Bayer elige entre tonos vecinos y da sensación de degradado sin perder el pixel art.
 */
export const TERRAIN_RAMPS = {
  forest:  [0x2f6b34, 0x3f8a3c, 0x55a847, 0x6fc152, 0x8fd468],
  marsh:   [0x35603a, 0x447a43, 0x5a9150, 0x74a85e, 0x93be72],
  desert:  [0xc0914a, 0xd6a956, 0xe6bf68, 0xf0d27f, 0xf8e3a0],
  tundra:  [0xaebfcc, 0xc6d4de, 0xdbe5ec, 0xebf2f6, 0xffffff],
  water:   [0x174f88, 0x1d5f9e, 0x2678b8, 0x3192cf, 0x45abe0],
  shallow: [0x2f8fc4, 0x3aa6cf, 0x4fbfd8, 0x72d0df, 0x9fe0e6],
  sand:    [0xc49a5c, 0xd8b375, 0xe6c78c, 0xf0d9a6, 0xf8e8c4],
  wetsand: [0x8f7550, 0xa3865c, 0xb59869, 0xc4a878, 0xd2b88a],
  gravel:  [0x6f7a87, 0x87919d, 0x9fa8b3, 0xb7bec7, 0xcfd5db],
  // Materiales que dejan las arenas
  humus:   [0x3b2a1e, 0x4e3726, 0x63452e, 0x7a5638, 0x8f6844],
  ash:     [0x5d5d61, 0x75757a, 0x8e8e93, 0xa8a8ad, 0xc2c2c6],
  ice:     [0x9cc9e0, 0xb5d9ec, 0xcbe6f3, 0xdff0f8, 0xf2fafd],
  mud:     [0x4a3a26, 0x5a4730, 0x6b553a, 0x7c6445, 0x8d7452],
  peat:    [0x2c2418, 0x3a2f1f, 0x483a27, 0x574631, 0x66523b],
  charred: [0x16120f, 0x221c18, 0x2f2722, 0x3d332c, 0x4c4038],
} as const;

/** Paredes entre terrazas: [labio, tierra clara, media, oscura] */
export const TERRAIN_WALLS = {
  forest: [0x3f8a3c, 0x8f5f3d, 0x744b31, 0x573726],
  desert: [0xd6a956, 0xc08a4c, 0xa1703c, 0x7f552d],
  tundra: [0xdbe5ec, 0x9aa7b4, 0x7f8c9a, 0x65717f],
  rock:   [0x9aa1a6, 0x7d858b, 0x656c72, 0x4e545a],
  charred:[0x3d332c, 0x2a221d, 0x1e1814, 0x130f0c],
} as const;

/** Espuma de las cascadas */
export const WATERFALL = [0xe8fbff, 0xa6e4f2, 0x5fc0e0] as const;

/** Nubes: rampa de 5 tonos (sombra → luz) con tramado, como el terreno */
export const CLOUD_RAMP = [0x8ea3c6, 0xaebfdb, 0xcbd8ea, 0xe3ebf6, 0xf7faff] as const;

/** Sombra de la isla proyectada sobre las nubes */
export const CLOUD_SHADOW = 0x6f86ad;
