// Dibujo de la fauna [PROPUESTA]: colores, tamaños y ritmo de las animaciones. Se afinan en la fase de pulido.
// Los sprites se generan por código a partir de piezas y una pose (rendering/fauna/deer-art.ts), como las plantas.

/** Lienzo de cada fotograma (px de arte) y fila del suelo (donde apoyan las pezuñas) */
export const DEER_CANVAS = { w: 28, h: 30, ground: 26, footX: 14 } as const;

/** Escala de cada tipo de ciervo respecto al lienzo (la cría, más pequeña) */
export const DEER_SCALE = { male: 0.78, female: 0.78, fawn: 0.55 } as const;

/** Rampas de color (de sombra a luz, luz de arriba a la izquierda como las plantas) */
export const DEER_COLORS = {
  outline: 0x28160c,
  fur: [0x5c2e14, 0x7a401c, 0x9a5828, 0xba763c, 0xd69658, 0xecb676],
  cream: [0xc4a87c, 0xe2cca0, 0xf6e8c8],
  hoof: 0x2c1e16,
  antler: [0x967850, 0xc4aa78, 0xe2cea0],
  spot: 0xfaf0dc,
  innerEar: 0xe6aa96,
  nose: 0x22180f,
  eye: 0x120c08,
} as const;

/** Fotogramas por animación y milisegundos reales por fotograma */
export const FAUNA_ANIM = {
  idle: { frames: 2, ms: [2600, 280] },
  walk: { frames: 4, ms: [150] },
  run: { frames: 4, ms: [90] },
  eat: { frames: 2, ms: [700, 500] },
  drink: { frames: 2, ms: [900, 400] },
  sleep: { frames: 1, ms: [1000] },
  dead: { frames: 1, ms: [1000] },
} as const;

/** Lo deprisa que el sprite alcanza su posición (ms): suaviza el paso de minuto en minuto */
export const FAUNA_SMOOTH_MS = 90;
/** Ancho de la sombra de un adulto (px de arte) */
export const DEER_SHADOW = 13;
/** Selección: color del rombo y de la flecha, y medio ancho del rombo (px de arte) */
export const SELECT_COLOR = 0xf2b33d;
export const SELECT_HALF_W = 11;
