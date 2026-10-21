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
  /** Lo que sube el signo si el animal lleva la flecha de selección (la altura de cada tipo está en SPECIES_ART) */
  selectedLift: 7,
} as const;

/**
 * Vista de lejos: por debajo de este zoom (escala de la cámara) cada manada se dibuja como una moneda con la cara
 * de su especie y el número de animales, en vez de un sprite por animal (se lee mejor y se dibuja mucho menos).
 */
export const FAUNA_LOD = { coinsBelow: 2 } as const;

/** Moneda: diámetro (px de arte), colores del canto (luz, medio, sombra) y del fondo, e insignia del número */
export const COIN = {
  size: 17,
  outline: 0x2e1a0d,
  rim: [0xf6d87a, 0xe8b448, 0xb88028],
  face: 0x6e8a3c,
  faceShade: 0x566e2e,
  badge: 0x5c3418,
  digit: 0xfff1d0,
  /** Sombra (px de arte de ancho) */
  shadow: 15,
} as const;

/**
 * Cara de cada especie en su moneda (9 px de ancho; '.' = fondo) y sus colores. Añadir una especie = su cara aquí.
 */
export const COIN_FACES: Readonly<Record<string, { readonly rows: readonly string[]; readonly colors: Readonly<Record<string, number>> }>> = {
  deer: {
    rows: [
      'A.a...a.A',
      '.aa...aa.',
      'EiE...EiE',
      '.EEHHHEE.',
      '..HeHeH..',
      '..hHHHh..',
      '...hcH...',
      '...cnc...',
    ],
    colors: { a: 0xc4aa78, A: 0xe2cea0, E: 0x7a401c, H: 0xba763c, h: 0x9a5828, e: 0x120c08, c: 0xf6e8c8, n: 0x22180f, i: 0xe6aa96 },
  },
  rabbit: {
    rows: [
      '.E.....E.',
      '.Ei...iE.',
      '.Ei...iE.',
      '..EHHHE..',
      '.HHHHHHH.',
      '.HeHHHeH.',
      '..HcncH..',
      '...ccc...',
    ],
    colors: { E: 0x846a4e, i: 0xe2a49a, H: 0xa18664, e: 0x120c08, c: 0xece0c6, n: 0xc87a74 },
  },
};

/** Cifras de 3 × 5 px para la insignia */
export const COIN_DIGITS: readonly (readonly string[])[] = [
  ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], ['.x.', 'xx.', '.x.', '.x.', 'xxx'], ['xx.', '..x', '.x.', 'x..', 'xxx'],
  ['xx.', '..x', '.x.', '..x', 'xx.'], ['x.x', 'x.x', 'xxx', '..x', '..x'], ['xxx', 'x..', 'xx.', '..x', 'xx.'],
  ['.xx', 'x..', 'xxx', 'x.x', 'xxx'], ['xxx', '..x', '.x.', '.x.', '.x.'], ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
  ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
];

// ── Conejo ──
/** Lienzo de cada fotograma del conejo (px de arte) y fila del suelo */
export const RABBIT_CANVAS = { w: 16, h: 14, ground: 12, footX: 8 } as const;
/** Escala de cada tipo (el gazapo, mucho más pequeño) */
export const RABBIT_SCALE = { male: 0.72, female: 0.66, kit: 0.45 } as const;
/** Pardo grisáceo (agutí) de sombra a luz, vientre crema, cola blanca */
export const RABBIT_COLORS = {
  outline: 0x2a1c12,
  fur: [0x4a3828, 0x66503a, 0x846a4e, 0xa18664, 0xbca07a, 0xd6bc96],
  belly: [0xd8c8a8, 0xece0c6],
  tail: [0xe6e0d2, 0xfbf8f0],
  innerEar: 0xe2a49a,
  eye: 0x120c08,
  nose: 0xc87a74,
} as const;
/** Entrada de la madriguera (px de arte): agujero oscuro con tierra removida alrededor */
export const BURROW_COLORS = {
  outline: 0x2a1c12,
  hole: [0x140d08, 0x2a1c12],
  dirt: [0x5a4028, 0x7a5a38, 0x98764c],
  /** Tapada por la Duna */
  sand: [0xc9a35e, 0xe0c07a],
} as const;

/**
 * Dibujo de cada especie en el mapa: lienzo de sus fotogramas, escala de cada tipo (macho, hembra y su cría),
 * ancho de la sombra del adulto, altura (px de arte sobre los pies) del signo '!'/'?' y de la flecha de
 * selección de cada tipo, y la caja que se puede tocar (adulto). Añadir una especie = su entrada aquí, su
 * generador en rendering/fauna/fauna-sprites.ts y su cara de moneda (COIN_FACES).
 */
export interface SpeciesArtDef {
  readonly canvas: { readonly w: number; readonly h: number; readonly ground: number; readonly footX: number };
  /** Nombre del tipo de las crías (los adultos son 'male' y 'female') */
  readonly young: string;
  readonly scale: Readonly<Record<string, number>>;
  readonly shadow: number;
  readonly head: Readonly<Record<string, number>>;
  readonly arrow: Readonly<Record<string, number>>;
  readonly hit: { readonly half: number; readonly top: number };
}

export const SPECIES_ART: Readonly<Record<string, SpeciesArtDef>> = {
  deer: {
    canvas: DEER_CANVAS, young: 'fawn', scale: DEER_SCALE, shadow: DEER_SHADOW,
    head: { male: 21, female: 18, fawn: 13 },
    arrow: { male: 20, female: 20, fawn: 14 },
    hit: { half: 7, top: 17 },
  },
  rabbit: {
    canvas: RABBIT_CANVAS, young: 'kit', scale: RABBIT_SCALE, shadow: 8,
    head: { male: 13, female: 12, kit: 9 },
    arrow: { male: 14, female: 13, kit: 10 },
    hit: { half: 5, top: 12 },
  },
};
