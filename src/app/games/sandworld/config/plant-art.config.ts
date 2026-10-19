// Dibujo de las plantas [PROPUESTA]: rampas de color y piezas de cada sprite. El generador
// (rendering/vegetation/plant-art.ts) las ilumina como pequeños sólidos con la luz arriba a la izquierda.

/**
 * Rampas de 6 tonos (oscuro → claro) con el tono desplazado: las sombras tiran a frío (verde azulado)
 * y las luces a cálido (amarillo). Es lo que separa una planta del césped aunque las dos sean verdes.
 */
export const PLANT_RAMPS = {
  leaf:    [0x123a33, 0x1f5c3a, 0x2f7d3a, 0x4f973a, 0x86bb44, 0xc4e06a],
  pine:    [0x0e2e30, 0x17463e, 0x235f45, 0x367a4a, 0x5c9a52, 0x9cc070],
  willow:  [0x1a4034, 0x2a6440, 0x3f8644, 0x64a64a, 0x9cc85a, 0xd2e88a],
  bush:    [0x15382f, 0x22553a, 0x34753e, 0x52903e, 0x82b84a, 0xbcdc6e],
  shade:   [0x10262c, 0x1a3a3a, 0x26504a, 0x386a58, 0x5a8a6a, 0x8ab08a],
  bramble: [0x1e2228, 0x2e3a2e, 0x3e5234, 0x56703c, 0x7c9446, 0xa8b860],
  cactus:  [0x153a2a, 0x205a36, 0x2f7a40, 0x4c9a4a, 0x7cbc5c, 0xb8dc84],
  grass:   [0x1c4a30, 0x2c6a36, 0x46903c, 0x72b446, 0xb0dc62, 0xe0f28a],
  reed:    [0x2a4a24, 0x3e6a2a, 0x5a8a30, 0x80a83a, 0xb0c85a, 0xdce490],
  moss:    [0x2a4a2a, 0x3c6432, 0x52803a, 0x6e9c44, 0x98bc5a, 0xc8dc84],
  trunk:   [0x2a1812, 0x3e2618, 0x5c3a22, 0x7e5530, 0xa47444, 0xc8955a],
  // Estados: sequía o sufrimiento, otoño, muerto
  dry:     [0x3a3424, 0x56502f, 0x76703e, 0x98904e, 0xb8ae66, 0xd8cc88],
  autumn:  [0x3a1a12, 0x6a2a14, 0x9a4a1a, 0xc8702a, 0xe8a03a, 0xf8d070],
  dead:    [0x2a1c12, 0x3e2a1a, 0x5a3e24, 0x7a5630, 0x9a7040, 0xb88a54],
  // Frutos (bayas, manzanas, flor del cactus)
  red:     [0x5a1018, 0x9a1e24, 0xd8343a, 0xf86a5a, 0xffc0a0, 0xffe4d0],
  blue:    [0x14205a, 0x22389a, 0x3a62d8, 0x78a8f8, 0xd0e8ff, 0xf0f8ff],
  purple:  [0x2a1238, 0x4a1e5a, 0x7a3a9a, 0xa868c8, 0xd8a8f0, 0xf4e0ff],
  pink:    [0x6a1a3a, 0x9a2a5a, 0xd8508a, 0xf888b8, 0xffc8e0, 0xfff0f6],
} as const;

export type RampKey = keyof typeof PLANT_RAMPS;

/** Colores planos de los detalles de las plantas pequeñas (flores, setas, piedra…) por carácter */
export const PLANT_FLAT: Readonly<Record<string, number>> = {
  w: 0xffffff, m: 0xc88ae8, P: 0x7a3a9a, c: 0x6ff0ff, e: 0xf0e2c0, o: 0xd9822b, y: 0xf2d24a,
  s: 0x7d858b, S: 0xaab2b8, n: 0x6a4a2a, t: 0x5a3a22, T: 0x7a5236, d: 0x4a3f33, D: 0x6b5a48, r: 0xd04a3a,
};

/**
 * Piezas de un sprite, en píxeles respecto al pie de la planta (x a la derecha del centro, y hacia arriba).
 * - trunk:  tronco de x0 a x1, de y0 a y1 (iluminado por la izquierda)
 * - blob:   racimo de hojas ovalado (radios rx, ry); `d` = profundidad (mayor = más delante)
 * - cone:   piso de un pino: triángulo de base `rx` a la altura y, de alto h
 * - hang:   ramas colgantes (sauce, enredadera): una línea de hojas hacia abajo desde y
 * - branch: rama de madera de un punto a otro (se ve cuando caen las hojas)
 * - fruit:  frutos (2 píxeles cada uno) en esos puntos; se los comen y vuelven
 * - map:    mapa de caracteres (plantas pequeñas): O g G L = tonos de la rampa; el resto, colores planos
 */
export type ArtPart =
  | { readonly kind: 'trunk'; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly ramp?: RampKey }
  | { readonly kind: 'blob'; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number; readonly d: number; readonly bias?: number; readonly ramp?: RampKey }
  | { readonly kind: 'cone'; readonly x: number; readonly y: number; readonly rx: number; readonly h: number; readonly d: number }
  | { readonly kind: 'hang'; readonly x: number; readonly y: number; readonly len: number }
  | { readonly kind: 'branch'; readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly ramp?: RampKey }
  | { readonly kind: 'fruit'; readonly at: readonly (readonly [number, number])[]; readonly ramp: RampKey }
  | { readonly kind: 'map'; readonly rows: readonly string[] };

export interface ArtSpec {
  /** Rampa de las hojas */
  readonly ramp: RampKey;
  readonly parts: readonly ArtPart[];
  /** Contorno selectivo (abajo y a la derecha): arbustos y árboles */
  readonly outline?: boolean;
  /** Ramas automáticas del tronco a cada racimo (se ven en invierno en los de hoja caduca) */
  readonly branches?: boolean;
}

const OAK_BLOBS: ArtPart[] = [
  { kind: 'blob', x: 3, y: 13.5, rx: 5, ry: 4, d: 0, bias: -0.15 },
  { kind: 'blob', x: -3, y: 13, rx: 5, ry: 4, d: 1, bias: -0.05 },
  { kind: 'blob', x: 0, y: 16.5, rx: 6, ry: 4.2, d: 2, bias: 0.05 },
  { kind: 'blob', x: 3.5, y: 10, rx: 4, ry: 3, d: 3, bias: -0.1 },
  { kind: 'blob', x: -3.5, y: 9.5, rx: 4, ry: 3, d: 3, bias: -0.1 },
  { kind: 'blob', x: 0, y: 10.5, rx: 5, ry: 3.4, d: 4 },
];
const BERRY_BLOBS: ArtPart[] = [
  { kind: 'blob', x: -2.2, y: 4.4, rx: 3.6, ry: 3, d: 0 },
  { kind: 'blob', x: 2.2, y: 4.4, rx: 3.6, ry: 3, d: 1 },
  { kind: 'blob', x: 0, y: 6.2, rx: 4, ry: 3, d: 2 },
  { kind: 'blob', x: 0, y: 3.2, rx: 4.2, ry: 2.4, d: 3 },
];
const BERRY_SPOTS: [number, number][] = [[-4, 6], [-1, 8], [2, 6], [-2, 3], [3, 3], [1, 4]];

/** Dibujo de cada planta (por clave del registro) y de las etapas y restos compartidos */
export const PLANT_ART: Readonly<Record<string, ArtSpec>> = {
  // ── Pequeñas: mapas de caracteres con luz automática ──
  grass: { ramp: 'grass', parts: [{ kind: 'map', rows: ['.L...L..', 'LG.L.GL.', 'GgLGLgG.', 'gGgGgGgL', '.gggggg.'] }] },
  clover: { ramp: 'grass', parts: [{ kind: 'map', rows: ['..w..L.', '.wwwLGL', 'LGwLGgG', 'GgLGgG.', '.gggg..'] }] },
  rockMoss: { ramp: 'moss', parts: [{ kind: 'map', rows: ['..LGL...', '.LGgGLS.', 'sSGSsGSs', 'SsSsSsSs', '.ssssss.'] }] },
  reed: { ramp: 'reed', parts: [{ kind: 'map', rows: ['n....n.', 'n.n..n.', 'n.n.LnL', 'L.n.G.G', 'G.LGG.G', 'GLGGLGG', '.GgGgG.', '..ggg..'] }] },
  thistle: { ramp: 'grass', parts: [{ kind: 'map', rows: ['m.m.m', 'PmPmP', '.PmP.', 'L.G.L', '.LGL.', 'G.G.G', '.gGg.'] }] },
  sage: { ramp: 'moss', parts: [{ kind: 'map', rows: ['.m...m.', '.m.m.m.', 'SmSLSmS', 'LSLSLSL', 'GSLGLSG', '.gGGGg.'] }] },
  swampShroom: { ramp: 'grass', parts: [{ kind: 'map', rows: ['.ooo.', 'oeoeo', 'ooooo', 'yoooy', '..e..', '.eee.'] }] },
  snowLichen: { ramp: 'moss', parts: [{ kind: 'map', rows: ['..oy.y.', '.ySyoSy', 'sSSSsSs', '.sssss.'] }] },
  glowFlower: { ramp: 'grass', parts: [{ kind: 'map', rows: ['..c..', '.cwc.', '..c..', '.gcg.', '..G..', '.gGg.'] }] },
  // ── Arbustos ──
  redBerries: { ramp: 'bush', outline: true, parts: [...BERRY_BLOBS, { kind: 'fruit', at: BERRY_SPOTS, ramp: 'red' }] },
  blueberry: { ramp: 'bush', outline: true, parts: [...BERRY_BLOBS, { kind: 'fruit', at: BERRY_SPOTS, ramp: 'blue' }] },
  shadeBerries: { ramp: 'shade', outline: true, parts: [...BERRY_BLOBS, { kind: 'fruit', at: BERRY_SPOTS, ramp: 'purple' }] },
  bramble: {
    ramp: 'bramble', outline: true, parts: [
      { kind: 'blob', x: -2.5, y: 3.6, rx: 3.4, ry: 2.6, d: 0 }, { kind: 'blob', x: 2.5, y: 3.6, rx: 3.4, ry: 2.6, d: 1 },
      { kind: 'blob', x: 0, y: 5.2, rx: 3.6, ry: 2.6, d: 2 },
      { kind: 'branch', from: [-5, 1], to: [-6, 6], ramp: 'dead' }, { kind: 'branch', from: [5, 1], to: [6, 7], ramp: 'dead' },
      { kind: 'branch', from: [0, 6], to: [-1, 9], ramp: 'dead' },
    ],
  },
  vine: {
    ramp: 'leaf', outline: true, parts: [
      { kind: 'blob', x: -3, y: 4, rx: 3.6, ry: 2.6, d: 0 }, { kind: 'blob', x: 3, y: 4.5, rx: 3.6, ry: 2.6, d: 1 },
      { kind: 'blob', x: 0, y: 6, rx: 3.4, ry: 2.4, d: 2 },
      { kind: 'hang', x: -5, y: 4, len: 4 }, { kind: 'hang', x: 5, y: 5, len: 5 }, { kind: 'hang', x: 1, y: 4, len: 4 },
    ],
  },
  cactus: {
    ramp: 'cactus', outline: true, parts: [
      { kind: 'blob', x: 0, y: 7, rx: 2.2, ry: 7, d: 2, bias: 0.05 },
      { kind: 'blob', x: -3.5, y: 8, rx: 1.4, ry: 3, d: 1 }, { kind: 'blob', x: -2, y: 5.5, rx: 1.6, ry: 1.1, d: 1 },
      { kind: 'blob', x: 3.5, y: 10, rx: 1.4, ry: 2.6, d: 1 }, { kind: 'blob', x: 2, y: 8, rx: 1.6, ry: 1.1, d: 1 },
      { kind: 'fruit', at: [[0, 14], [-4, 11]], ramp: 'pink' },
    ],
  },
  // ── Árboles ──
  oak: { ramp: 'leaf', outline: true, branches: true, parts: [{ kind: 'trunk', x0: -1, x1: 1, y0: 0, y1: 9 }, ...OAK_BLOBS] },
  appleTree: {
    ramp: 'leaf', outline: true, branches: true, parts: [
      { kind: 'trunk', x0: -1, x1: 1, y0: 0, y1: 8 },
      { kind: 'blob', x: 3, y: 11.5, rx: 4.4, ry: 3.6, d: 0, bias: -0.15 }, { kind: 'blob', x: -3, y: 11, rx: 4.4, ry: 3.6, d: 1 },
      { kind: 'blob', x: 0, y: 14, rx: 5, ry: 3.6, d: 2, bias: 0.05 }, { kind: 'blob', x: 0, y: 9, rx: 4.6, ry: 3, d: 3 },
      { kind: 'fruit', at: [[-4, 11], [3, 14], [1, 9], [4, 10], [-2, 15], [-1, 12]], ramp: 'red' },
    ],
  },
  pine: {
    ramp: 'pine', outline: true, parts: [
      { kind: 'trunk', x0: -1, x1: 1, y0: 0, y1: 5 },
      { kind: 'cone', x: 0, y: 4, rx: 6.2, h: 8, d: 0 }, { kind: 'cone', x: 0, y: 8, rx: 5.2, h: 7, d: 1 },
      { kind: 'cone', x: 0, y: 12, rx: 4.2, h: 6, d: 2 }, { kind: 'cone', x: 0, y: 15.5, rx: 3.2, h: 5, d: 3 },
      { kind: 'cone', x: 0, y: 18.5, rx: 2, h: 4, d: 4 },
    ],
  },
  willow: {
    ramp: 'willow', outline: true, branches: true, parts: [
      { kind: 'trunk', x0: -1, x1: 1, y0: 0, y1: 11 },
      { kind: 'blob', x: -3, y: 14, rx: 4.4, ry: 3.2, d: 0 }, { kind: 'blob', x: 3, y: 14, rx: 4.4, ry: 3.2, d: 1 },
      { kind: 'blob', x: 0, y: 16, rx: 5, ry: 3, d: 2, bias: 0.05 },
      { kind: 'hang', x: -7, y: 13, len: 8 }, { kind: 'hang', x: -5, y: 12, len: 9 }, { kind: 'hang', x: -2, y: 12, len: 6 },
      { kind: 'hang', x: 2, y: 12, len: 7 }, { kind: 'hang', x: 5, y: 12, len: 9 }, { kind: 'hang', x: 7, y: 13, len: 7 },
    ],
  },
  deadTree: {
    ramp: 'dead', outline: false, parts: [
      { kind: 'trunk', x0: -1, x1: 0, y0: 0, y1: 10, ramp: 'dead' },
      { kind: 'branch', from: [0, 7], to: [5, 13], ramp: 'dead' }, { kind: 'branch', from: [-1, 9], to: [-5, 15], ramp: 'dead' },
      { kind: 'branch', from: [0, 10], to: [1, 16], ramp: 'dead' }, { kind: 'branch', from: [3, 10], to: [6, 10], ramp: 'dead' },
      { kind: 'branch', from: [-3, 12], to: [-6, 12], ramp: 'dead' },
    ],
  },
  // ── Etapas y restos compartidos ──
  seed: { ramp: 'grass', parts: [{ kind: 'map', rows: ['.L.', 'TtT'] }] },
  sprout: { ramp: 'grass', parts: [{ kind: 'map', rows: ['L...L', '.LGL.', 'L.G.L', '..g..'] }] },
  tilled: { ramp: 'grass', parts: [{ kind: 'map', rows: ['.DnDn.', 'nDnDnD', '.nDnD.'] }] },
  stump: { ramp: 'trunk', parts: [{ kind: 'map', rows: ['.eTe.', 'tTTtt', 'ttTtd'] }] },
  dryBush: { ramp: 'dead', parts: [{ kind: 'map', rows: ['d..D..d', '.d.D.d.', 'D.dDd.D', '.ddDdd.', '..dDd..'] }] },
};

/** Las plantas jóvenes se dibujan con sus mismas piezas a esta escala (las pequeñas, con sus filas de abajo) */
export const YOUNG_SCALE = 0.6;
