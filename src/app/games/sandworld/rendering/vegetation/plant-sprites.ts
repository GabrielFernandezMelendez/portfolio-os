import { Texture } from 'pixi.js';

/*
  Sprites pixel de las plantas como mapas de caracteres ('.' = transparente), por clave del registro de plantas.
  FOLIAGE son los caracteres de hoja: los que cambian de color en otoño y caen en invierno.
  Los árboles de hoja caduca tienen además un mapa de ramas desnudas (BARE) que se ve al perder las hojas.
*/
const PALETTE: Readonly<Record<string, number>> = {
  g: 0x2f6b34, G: 0x4c9a3a, L: 0x8fd468, O: 0x1d4524, t: 0x5a3a22, T: 0x7a5236, r: 0xd04a3a, b: 0x3d6fd6, B: 0x9fd0f5,
  P: 0x7a3a9a, h: 0x2c4630, H: 0x40603f, y: 0xf2d24a, o: 0xd9822b, w: 0xffffff, s: 0x7d858b, S: 0xaab2b8, d: 0x4a3f33,
  D: 0x6b5a48, c: 0x6ff0ff, m: 0xc88ae8, n: 0x6a4a2a, e: 0xf0e2c0,
};
/** Colores de otoño de cada carácter de hoja */
const AUTUMN: Readonly<Record<string, number>> = { g: 0x9a5a2a, G: 0xd9822b, L: 0xf0b050, O: 0x6a3a1a };
/** Hierba y hojas secas de invierno */
const DRY: Readonly<Record<string, number>> = { g: 0x7a7a5a, G: 0x9a9a78, L: 0xb8b898, O: 0x5a5a42 };
const FOLIAGE = new Set(['g', 'G', 'L', 'O', 'r']);
const SNOW_TOP = 0xfafcff;
const SNOW_SIDE = 0xdce8f4;

export const PLANT_SPRITES: Readonly<Record<string, readonly string[]>> = {
  grass: ['.L..L.', 'LG.LGL', 'GgLGgG', '.gggg.'],
  clover: ['.Lw.L.', 'LGwwGL', '.LGLG.', '..gg..'],
  rockMoss: ['..LGL..', '.LGgGS.', 'sSGSsSs', '.sssss.'],
  reed: ['n...n', 'n.n.n', 'n.n.G', 'G.n.G', 'GGG.G', '.GGGG', '.GgG.'],
  thistle: ['m.m.m', '.mPm.', '..m..', 'L.G.L', '.LGL.', '..G..', '.gGg.'],
  sage: ['.m...m.', '.m.m.m.', 'SmSLSmS', 'LSLSLSL', '.SLGLS.', '..GGG..'],
  swampShroom: ['.ooo.', 'oeoeo', 'ooooo', '..e..', '.eee.'],
  snowLichen: ['..oy.y.', '.ySyoSy', 'sSSSsSs'],
  glowFlower: ['..c..', '.cwc.', '..c..', '.gcg.', '..g..', '.gGg.'],
  redBerries: ['..OOOO..', '.OGLGrO.', 'OGrGGLGO', 'OLGGrGGO', 'OGrGGgrO', '.OggggO.', '..t..t..'],
  blueberry: ['..OOOO..', '.OGLGbO.', 'ObBGGLGO', 'OLGGbBGO', 'OGbGGgbO', '.OggggO.', '..t..t..'],
  shadeBerries: ['..dddd..', '.dHhHPd.', 'dPmhHhHd', 'dhHhPmhd', 'dHPhHhPd', '.dhhhhd.', '..t..t..'],
  bramble: ['n.O.On.n', '.OnGnO..', 'OGnGnGOn', 'nGOnGnGO', '.nGnOnG.', 'n.n..n.n'],
  vine: ['.L.O.L.O.', 'OLGLGLGLO', 'GOGLOGLOG', 'LGgLGgLGL', 'OL.GL.GO.', '.L..L..L.', '..L.....L'],
  cactus: ['...OO...', '..OLGO..', 'O.OLGO..', 'LO.LGO.O', 'OLLLGOLO', '.OOLGLLO', '...LGOO.', '...LGO..', '..OLGGO.'],
  oak: ['....OOO....', '..OOGGGOO..', '.OGGLLGGGO.', 'OGGLLLGGGGO', 'OGGLGGGGgGO', 'OGGGGGgGggO', '.OGgGGGggO.', '..OgggggO..', '...OOtOO...', '.....t.....', '....tTt....', '....tTt....', '...ttTtt...'],
  pine: ['....O....', '...OGO...', '...OGO...', '..OGLGO..', '..OgGgO..', '.OGLGGGO.', '..OgggO..', '.OGLGGGGO', 'OGGLGGGgO', '.OOgggOO.', 'OGLGGGGgO', 'OGGGGgggO', '.OOOOOOO.', '....t....', '...tTt...'],
  appleTree: ['...OOOOO...', '..OGGLGGO..', '.OGrGLLGGO.', 'OGGLGGrGGgO', 'OGrGGGGGrgO', 'OGGGGrGggGO', '.OGgGGGggO.', '..OOgggOO..', '....tTt....', '....tTt....', '...ttTtt...'],
  willow: ['....OOO....', '..OOGLGOO..', '.OGLGLGLGO.', 'OGLGgLgGLGO', 'OG.GgtgG.GO', 'OG.G.t.G.GO', 'OL.G.t.G.LO', '.L.L.t.L.L.', '.L...t...L.', '....tTt....', '...ttTtt...'],
  // Cultivos: brote recién sembrado y tierra labrada bajo cada planta sembrada
  sprout: ['L...L', '.LGL.', 'LGLGL', '..g..'],
  tilled: ['.DnDn.', 'nDnDnD', '.nDnD.'],
  deadTree: ['d.......d', '.d..d..d.', '..d.d.d..', '...ddd...', '.d..d....', '..d.d..d.', '...dddd..', '....dd...', '....d....', '....dD...', '...ddDd..'],
};

/** Ramas desnudas de los árboles de hoja caduca (mismo tamaño que su sprite con hojas) */
const BARE: Readonly<Record<string, readonly string[]>> = {
  oak: ['...........', '...........', '...........', '.d.....d...', '..d.d.d..d.', 'd..ddd..d..', '.d..d..dd..', '..dddddd...', '....dd.....', '.....t.....', '....tTt....', '....tTt....', '...ttTtt...'],
  appleTree: ['...........', '...........', '..d...d....', '...d.d..d..', 'd..ddd.d...', '.d..dd.....', '..ddd......', '....d......', '....tTt....', '....tTt....', '...ttTtt...'],
  willow: ['...........', '....ddd....', '..dd.d.dd..', '.d..d.d..d.', 'd...dtd...d', 'd....t....d', 'd....t....d', '.....t.....', '.....t.....', '....tTt....', '...ttTtt...'],
};

/** Estado de estación de una planta, ya redondeado a pasos (cada combinación es una textura en caché) */
export interface PlantLook {
  /** 0..1: cuánto se ha vuelto ocre */
  readonly autumn: number;
  /** 0..1: cuántas hojas le quedan (árboles de hoja caduca) */
  readonly leaves: number;
  /** 0..1: cuánto se ha secado (hierba en invierno) */
  readonly dry: number;
  readonly snow: boolean;
}

export const LOOK_STEPS = 6;
const cache = new Map<string, Texture>();

/** Textura de una planta con un aspecto de estación. Se genera una vez por combinación. */
export function plantTexture(key: string, look: PlantLook): Texture {
  const id = `${key}|${look.autumn}|${look.leaves}|${look.dry}|${look.snow}`;
  let tex = cache.get(id);
  if (tex) return tex;
  const rows = PLANT_SPRITES[key];
  const bare = BARE[key];
  const w = rows[0].length, h = rows.length;
  // Una fila más abajo para las hojas caídas al pie del árbol
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + 1;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h + 1);
  const px = new Map<number, number>();   // índice → color
  // Ramas desnudas debajo (si las hay); encima, las hojas que le quedan
  if (bare) bare.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') px.set(j * w + i, PALETTE[ch]); }));
  let fallen = 0;
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.') return;
    const leaf = FOLIAGE.has(ch);
    if (bare && leaf && pixelHash(i, j, 1) >= look.leaves) { fallen++; return; }
    if (bare && !leaf && px.has(j * w + i)) return;
    let color = PALETTE[ch];
    if (leaf && AUTUMN[ch] !== undefined && pixelHash(i, j, 2) < look.autumn) color = AUTUMN[ch];
    if (leaf && DRY[ch] !== undefined && pixelHash(i, j, 3) < look.dry) color = DRY[ch];
    px.set(j * w + i, color);
  }));
  // Hojas caídas: unas pocas al pie mientras el árbol las pierde
  if (bare && look.leaves > 0 && look.leaves < 1) {
    const n = Math.min(w - 2, Math.ceil(fallen / 6));
    for (let f = 0; f < n; f++) {
      const x = Math.floor(pixelHash(f, 9, 4) * w);
      px.set(h * w + x, pixelHash(f, 9, 5) < 0.5 ? AUTUMN['G'] : AUTUMN['L']);
    }
  }
  // Nieve: el píxel más alto de cada columna, y alguno más por debajo en los árboles
  if (look.snow) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (!px.has(j * w + i)) continue;
        px.set(j * w + i, SNOW_TOP);
        if (px.has((j + 1) * w + i) && i % 2 === 0 && j + 1 < h - 2) px.set((j + 1) * w + i, SNOW_SIDE);
        break;
      }
    }
  }
  for (const [k, c] of px) {
    img.data[k * 4] = c >> 16;
    img.data[k * 4 + 1] = (c >> 8) & 255;
    img.data[k * 4 + 2] = c & 255;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  cache.set(id, tex);
  return tex;
}

/** Tamaño de un sprite (para colocarlo con el pie en su celda) */
export function plantSize(key: string): { w: number; h: number } {
  const rows = PLANT_SPRITES[key];
  return { w: rows[0].length, h: rows.length };
}

/** Azar fijo por píxel: decide en qué orden cambian de color o caen las hojas */
function pixelHash(i: number, j: number, salt: number): number {
  let h = (i * 73856093) ^ (j * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
