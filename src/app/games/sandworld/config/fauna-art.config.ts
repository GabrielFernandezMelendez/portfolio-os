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
  howl: { frames: 1, ms: [1000] },
  /** En vuelo (aves): aleteo */
  fly: { frames: 4, ms: [110] },
  /** Persiguiendo a una presa con el arma en alto (humanos y goblins); los demás la dibujan corriendo */
  hunt: { frames: 4, ms: [95] },
  /** Cuerpo a cuerpo: los golpes los anima la capa con FAUNA_COMBAT (un solo dibujo: la embestida) */
  fight: { frames: 1, ms: [1000] },
} as const;

/**
 * Golpes del cuerpo a cuerpo [PROPUESTA], en tiempo real (ms) dentro de cada ciclo: se echa atrás (`windup`), embiste
 * (`lunge`) y el golpe llega (`impact`): el que lo recibe parpadea en blanco (`flashMs`), retrocede y tiembla. Los dos
 * se turnan si el atacado sabe defenderse (o caza); si no, solo golpea el atacante. Distancias en px de mundo.
 */
export const FAUNA_COMBAT = {
  cycleMs: 620,
  windup: [0, 140], lunge: [140, 230], impact: [230, 340],
  backPx: 1, lungePx: 3, knockPx: 2, shakePx: 1, shakeMs: 45, flashMs: 90,
  /** Separación mínima entre los dos al dibujarlos (px de mundo): encarados, sin montarse uno encima del otro */
  standoffPx: 12,
} as const;

/**
 * Efectos del combate: sangre (oscura, media, clara), cuántas gotas saltan por golpe (normal, al caer), a qué altura del
 * cuerpo (px), gravedad de las gotas (px por fotograma), minutos de juego que tarda en borrarse una mancha, tope de
 * manchas a la vez, el polvo y la chispa de cuando la sangre está desactivada (puntos alrededor del golpe).
 */
export const COMBAT_FX = {
  blood: [0x6e0c0c, 0x9a1414, 0xc4241c],
  drops: [3, 5],
  hitHeight: 6,
  gravity: 0.25,
  stainMinutes: 1440,
  maxStains: 300,
  dust: 0xe8dcbe, dustPuffs: 3, dustMs: 320,
  spark: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, -2], [2, 2], [2, -2], [-2, 2]],
  sparkMs: 140,
  /** Rastro del que huye herido: una gota cada tantos ms reales; charco bajo el cadáver (medio ancho en px por tamaño) */
  dripMs: 260,
  pool: { small: 3, medium: 5, large: 7 },
} as const;

/** Lo deprisa que el sprite alcanza su posición (ms): suaviza el paso de minuto en minuto */
export const FAUNA_SMOOTH_MS = 90;
/** Ancho de la sombra de un adulto (px de arte) */
export const DEER_SHADOW = 13;
/** Selección: color del rombo y de la flecha, y medio ancho del rombo (px de arte) */
export const SELECT_COLOR = 0xf2b33d;
export const SELECT_HALF_W = 11;

/**
 * Signos sobre la cabeza ('!' susto, '?' curiosidad, espada en un combate, polvareda al huir de él): colores, dibujo
 * (px de arte: o contorno, W brillo y las letras de cada signo) y animación: salto al salir (px por fotograma de
 * POP_MS), balanceo y desvanecido.
 */
export const SIGNAL_COLORS = {
  outline: 0x2e1a0d,
  shine: 0xfff1d0,
  /** Letras de cada signo (además de o contorno y W brillo) */
  alarm: { A: 0xe84a2a, a: 0xa82a18 },
  curious: { A: 0xf6d04c, a: 0xc89228 },
  /** Espada: hoja de acero (S luz, s sombra), guarda dorada (G, g) y empuñadura de cuero (H, h) */
  fight: { S: 0xdfe6ee, s: 0x8e9aa8, G: 0xf2b33d, g: 0xb07818, H: 0x7a4a24, h: 0x4e2e14 },
  /** Huida: polvareda (D luz, d sombra) y rayas de velocidad (A) */
  flee: { D: 0xf0e6cc, d: 0xbfae88, A: 0x8fd8f2 },
} as const;
export const SIGNAL_GLYPHS = {
  fight: [
    '..........o.',
    '.........oWo',
    '........oWWo',
    '.......oSso.',
    '......oSso..',
    '.o...oSso...',
    'oGo.oSso....',
    '.oGoSso.....',
    '..oGoo......',
    '..oHgo......',
    '.ohoogo.....',
    'oGo..o......',
    '.o..........',
  ],
  flee: [
    '.....oo..oooo..',
    '..oooDDooAAAWo.',
    '.oDDDDDDooooo..',
    '.oDDDDDdo.oooo.',
    'oDDDDDDdooAAAWo',
    '.oDDdDDDo.oooo.',
    '.oDddDDdoooo...',
    '..oooDdooAAWo..',
    '.....oo..ooo...',
  ],
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

/**
 * Agachado acechando (depredador ya a la vista de su presa): el dibujo se aplasta (`squash` de su alto), se oscurece
 * un poco (`tint`) y los pasos van más despacio (`steps` de la velocidad de la animación)
 */
export const FAUNA_CROUCH = { squash: 0.78, tint: 0xb8b0a8, steps: 0.5 } as const;

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
export const COIN_FACES: Readonly<Record<string, { readonly rows: readonly string[]; readonly colors: Readonly<Record<string, number>>; readonly oy?: number }>> = {
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
  // Ojos rojos: a simple vista, un depredador
  wolf: {
    rows: [
      'E.......E',
      'EE.....EE',
      'EiEHHHEiE',
      '.EHHHHHE.',
      'HeHHHHHeH',
      '.HHcccHH.',
      '..ccncc..',
      '...ccc...',
    ],
    colors: { E: 0x46423e, H: 0x8b857c, e: 0xff1a1a, c: 0xe3dacb, n: 0x141210, i: 0x7a5a50 },
  },
  // Cuervo visto desde arriba: la cabeza arriba con los dos ojos rojos y el pico largo hacia abajo
  crow: {
    rows: [
      '..bBBBb..',
      '.bBBBBBb.',
      'BkRBBBRkB',
      'BBrBBBrBB',
      '.BBGGGBB.',
      '..BGgGB..',
      '...GgG...',
      '...GgG...',
      '....g....',
    ],
    colors: { B: 0x1c1926, b: 0x4a4566, k: 0x0a0810, R: 0xff1a1a, r: 0x8a0a0a, G: 0x8a8a94, g: 0x4a4a52 },
    oy: 3,
  },
  // Goblin de frente: orejas largas a los lados, ojos amarillos, sonrisa de colmillos
  goblin: {
    rows: [
      'G.......g',
      'GG.ggg.gg',
      '.GGGGGgg.',
      '.GyYGyYg.',
      '..GGgGg..',
      '..MtMtM..',
      '...ggg...',
    ],
    colors: { G: 0x76a83e, g: 0x427022, y: 0xfff2a0, Y: 0xffd040, M: 0x1a0a06, t: 0xf4ecd8 },
  },
  // El humano no tiene patrón: su moneda lleva el retrato de su propio sprite en alta densidad (COIN_PORTRAIT)
};

/**
 * Monedas con retrato (especies en alta densidad): el aro se dibuja a esa densidad y dentro va la cabeza y los
 * hombros del sprite (`kind` quieto, de frente), recortada en círculo. `top` = filas del sprite que entran.
 */
export const COIN_PORTRAIT: Readonly<Record<string, { readonly kind: string; readonly top: number; readonly radius: number; readonly oy: number }>> = {
  human: { kind: 'male', top: 17, radius: 11.6, oy: 7 },
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
  /** Cueva de roca (guarida natural del lobo): rampa de gris, musgo */
  rock: [0x4e4b47, 0x6b6762, 0x8a857e, 0xa8a39a, 0xc4bfb5],
  moss: [0x4f6e2c, 0x6a8c38],
  /** Guarida de ramas (la construyen los lobos) */
  branch: [0x3e2614, 0x5a3a20, 0x7a5430, 0x9a7044],
} as const;

// ── Lobo ──
/** Lienzo de cada fotograma del lobo (px de arte) y fila del suelo */
export const WOLF_CANVAS = { w: 26, h: 22, ground: 19, footX: 13 } as const;
/** Escala de cada tipo: algo más bajo que el ciervo pero largo; el cachorro, pequeño */
export const WOLF_SCALE = { male: 0.8, female: 0.74, pup: 0.5 } as const;
/** Gris lobo de sombra a luz, lomo oscuro, vientre y hocico claros */
export const WOLF_COLORS = {
  outline: 0x1e1a18,
  fur: [0x3c3a38, 0x55524e, 0x6f6a64, 0x8b857c, 0xa59f94, 0xc0b9ad],
  saddle: [0x2e2c2a, 0x46423e],
  cream: [0xc9bfae, 0xe3dacb],
  nose: 0x141210,
  /** Rojo saturado: a simple vista, un depredador */
  eye: 0xff1a1a,
  innerEar: 0x7a5a50,
} as const;

// ── Cuervo, humano y goblin (sus colores viven en su generador: rendering/fauna/crow-art.ts...) ──
/** Lienzos (px de arte) y fila del suelo. El humano, a doble densidad (cada px de arte = medio px de mundo) */
export const CROW_CANVAS = { w: 22, h: 18, ground: 15, footX: 11 } as const;
export const HUMAN_CANVAS = { w: 40, h: 60, ground: 54, footX: 20 } as const;
export const GOBLIN_CANVAS = { w: 22, h: 24, ground: 21, footX: 11 } as const;
/** Nido del cuervo: px de mundo por encima del suelo (en la copa del árbol que lo sostiene) */
export const NEST_LIFT = 13;

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
  /**
   * Densidad del dibujo: píxeles de arte por píxel de mundo (1 = como el resto; 2 = el humano, con el doble de
   * detalle en el mismo tamaño). El lienzo va en píxeles de arte; head, arrow, hit y shadow, en píxeles de mundo.
   */
  readonly density?: number;
  /** Variantes del mismo tipo (p. ej. tono de piel): cada individuo lleva la suya (por su id) */
  readonly variants?: number;
  /** Aves: altura (px de mundo) a la que vuela el sprite; la sombra se queda en el suelo */
  readonly flyLift?: number;
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
  wolf: {
    canvas: WOLF_CANVAS, young: 'pup', scale: WOLF_SCALE, shadow: 12,
    head: { male: 15, female: 14, pup: 10 },
    arrow: { male: 16, female: 15, pup: 11 },
    hit: { half: 8, top: 14 },
  },
  crow: {
    canvas: CROW_CANVAS, young: 'chick', scale: { male: 0.78, female: 0.78, chick: 0.5 }, shadow: 7,
    head: { male: 12, female: 12, chick: 8 },
    arrow: { male: 13, female: 13, chick: 9 },
    hit: { half: 5, top: 11 },
    flyLift: 14,
  },
  human: {
    canvas: HUMAN_CANVAS, young: 'child', scale: { male: 1, female: 0.93, child: 0.66 }, shadow: 9,
    head: { male: 26, female: 24, child: 18 },
    arrow: { male: 27, female: 25, child: 19 },
    hit: { half: 5, top: 24 },
    density: 2,
    variants: 2,
  },
  goblin: {
    canvas: GOBLIN_CANVAS, young: 'young', scale: { male: 1, female: 1, young: 0.7 }, shadow: 9,
    head: { male: 20, female: 20, young: 15 },
    arrow: { male: 21, female: 21, young: 16 },
    hit: { half: 6, top: 18 },
  },
};
