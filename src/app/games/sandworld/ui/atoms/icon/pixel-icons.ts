/*
  Iconos pixel del HUD dibujados como mapas de caracteres.
  Cada carácter es un píxel; '.' es transparente. Así se editan a mano sin herramientas
  y se pintan como SVG nítido a cualquier escala.
  'L' y 'l' son el color "líquido" (lo usan las botellas de arena) y su brillo.
*/

export const ICON_PALETTE: Readonly<Record<string, string>> = {
  k: '#2e1a0d',   // contorno
  w: '#fff6e0',   // blanco cálido
  y: '#f7d14a',   // amarillo
  o: '#d9822b',   // naranja / oro oscuro
  b: '#3d8fd6',   // azul
  B: '#9fd8f5',   // azul claro
  g: '#4c9a3a',   // verde
  G: '#8fd468',   // verde claro
  m: '#efe9c8',   // luna
  M: '#bdb48c',   // sombra de luna
  p: '#f7dfa8',   // pergamino
  P: '#d9b277',   // pergamino oscuro
  r: '#c8483a',   // rojo
  R: '#8e2f27',   // rojo oscuro
  s: '#b7bec7',   // gris
  S: '#6f7a87',   // gris oscuro
  c: '#a8693a',   // corcho / madera
  t: '#d8eef5',   // cristal
};

export const PIXEL_ICONS: Readonly<Record<string, readonly string[]>> = {
  sun: [
    '.....yy.....',
    '.y...yy...y.',
    '..y......y..',
    '....oooo....',
    '...oyyyyo...',
    'yy.oyyyyo.yy',
    'yy.oyyyyo.yy',
    '...oyyyyo...',
    '....oooo....',
    '..y......y..',
    '.y...yy...y.',
    '.....yy.....',
  ],
  rain: [
    '...ssss.....',
    '..swwwws....',
    '.swwwwwwss..',
    'swwwwwwwwws.',
    'swwwwwwwwwws',
    '.ssssssssss.',
    '............',
    '..B...B...B.',
    '.B...B...B..',
    '............',
    '...B...B....',
    '..B...B.....',
  ],
  snow: [
    '...ssss.....',
    '..swwwws....',
    '.swwwwwwss..',
    'swwwwwwwwws.',
    'swwwwwwwwwws',
    '.ssssssssss.',
    '............',
    '..w...w...w.',
    '.www.www.www',
    '..w...w...w.',
    '....w...w...',
    '...www.www..',
  ],
  moon: [
    '....MMMM....',
    '..MMmmmM....',
    '.MmmmmM.....',
    '.Mmmmm......',
    'MmmmmM......',
    'Mmmmmm......',
    'Mmmmmm......',
    'MmmmmmM.....',
    '.MmmmmmM..M.',
    '.MMmmmmmmMM.',
    '..MMMmmmMM..',
    '....MMMM....',
  ],
  gear: [
    '....kk....',
    '.kk.ss.kk.',
    '.kssssssk.',
    '..ssSSss..',
    'kssS..Sssk',
    'kssS..Sssk',
    '..ssSSss..',
    '.kssssssk.',
    '.kk.ss.kk.',
    '....kk....',
  ],
  pause: [
    '.kkk..kkk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kwk..kwk.',
    '.kkk..kkk.',
  ],
  play: [
    '.kk.......',
    '.kwk......',
    '.kwwk.....',
    '.kwwwk....',
    '.kwwwwk...',
    '.kwwwwk...',
    '.kwwwk....',
    '.kwwk.....',
    '.kwk......',
    '.kk.......',
  ],
  drop: [
    '....kk....',
    '...kBBk...',
    '...kBbk...',
    '..kBbbbk..',
    '..kBbbbk..',
    '.kBbbbbbk.',
    '.kBbbbbbk.',
    '.kbbbbbbk.',
    '..kbbbbk..',
    '...kkkk...',
  ],
  leaf: [
    '......kkkk',
    '....kkGGGk',
    '...kGGGggk',
    '..kGGgggk.',
    '..kGgggk..',
    '.kGgggk...',
    '.kggkk....',
    '.kgk......',
    'k.k.......',
    'k.........',
  ],
  bottle: [
    '...kkkk...',
    '...kcck...',
    '...kttk...',
    '..kttttk..',
    '.kttwtttk.',
    '.kLlLLLLk.',
    '.kLlLLLLk.',
    '.kLLLLLLk.',
    '.kLLLLLLk.',
    '..kkkkkk..',
  ],
  scale: [
    '....oo....',
    '.oooooooo.',
    '.k..oo..k.',
    'k.k.oo.k.k',
    'k.k.oo.k.k',
    'yyy.oo.yyy',
    '....oo....',
    '...oooo...',
    '..oyyyyo..',
    '..kkkkkk..',
  ],
  letter: [
    'kkkkkkkkkk',
    'kPppppppPk',
    'kpPppppPpk',
    'kppPppPppk',
    'kpppPPpppk',
    'kppppRpppk',
    'kpppprrppk',
    'kkkkkkkkkk',
  ],
  book: [
    '.kkkkkkk..',
    '.krrrrrrk.',
    '.krryyrrk.',
    '.krrrrrrk.',
    '.krryyrrk.',
    '.krrrrrrk.',
    '.kRRRRRRk.',
    '.kkkkkkkk.',
    '.kppppppk.',
    '..kkkkkkk.',
  ],
  close: [
    'kk......kk',
    'kwk....kwk',
    '.kwk..kwk.',
    '..kwkkwk..',
    '...kwwk...',
    '...kwwk...',
    '..kwkkwk..',
    '.kwk..kwk.',
    'kwk....kwk',
    'kk......kk',
  ],
};

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/** Aclara un color #rrggbb (para el brillo del líquido) */
function lighten(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.round(v + (255 - v) * f);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const cache = new Map<string, { w: number; h: number; rects: PixelRect[] }>();

/** Convierte un icono en rectángulos (un rect por tramo horizontal del mismo color). Resultado cacheado. */
export function iconRects(name: string, liquid = '#c49a5c'): { w: number; h: number; rects: PixelRect[] } {
  const key = `${name}|${liquid}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rows = PIXEL_ICONS[name] ?? PIXEL_ICONS['close'];
  const colorOf = (ch: string): string | null =>
    ch === '.' ? null : ch === 'L' ? liquid : ch === 'l' ? lighten(liquid, 0.45) : ICON_PALETTE[ch] ?? null;

  const rects: PixelRect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = colorOf(row[x]);
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  const result = { w: Math.max(...rows.map(r => r.length)), h: rows.length, rects };
  cache.set(key, result);
  return result;
}
