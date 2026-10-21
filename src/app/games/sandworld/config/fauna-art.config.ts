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

/**
 * Signos sobre la cabeza ('!' susto, '?' curiosidad): colores, dibujo (px de arte: o contorno, W brillo,
 * A color, a sombra) y animación: salto al salir (px por fotograma de POP_MS), balanceo y desvanecido.
 */
export const SIGNAL_COLORS = {
  outline: 0x2e1a0d,
  shine: 0xfff1d0,
  alarm: [0xe84a2a, 0xa82a18],
  curious: [0xf6d04c, 0xc89228],
} as const;
export const SIGNAL_GLYPHS = {
  alarm: ['.ooo.', 'oWAAo', 'oAAAo', 'oAAao', '.oAo.', '.oao.', '..o..', '.ooo.', '.oAo.', '.ooo.'],
  curious: ['.ooooo.', 'oWAAAAo', 'oAooaAo', '.o.oAAo', '..oAAo.', '..oAo..', '..ooo..', '..oAo..', '..ooo..'],
} as const;
export const SIGNAL_ANIM = {
  /** Duración total (ms reales), lo que tarda en desvanecerse al final y balanceo (ms por medio vaivén) */
  ms: 2600, fadeMs: 450, bobMs: 330,
  /** Salto al salir: desplazamiento (px) en cada fotograma de popMs */
  pop: [4, -2, 1, 0], popMs: 80,
  /** Altura del signo sobre los pies (px de arte) de cada tipo (el macho, por encima de las astas) y lo que sube si lleva la flecha de selección */
  head: { male: 21, female: 18, fawn: 13 }, selectedLift: 7,
} as const;
