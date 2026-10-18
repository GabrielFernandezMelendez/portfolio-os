/*
  Marcos pixel 9-slice (madera, madera hundida, pergamino y tabla arcade) dibujados como mapas de caracteres.
  Se convierten a SVG en data-URI y el componente raíz los expone como variables CSS
  (--sw-frame-*) que usan los átomos con border-image. Así no ocupan presupuesto de CSS
  y se retocan igual que los iconos.

  Los de 9×9 se cortan en 3 (borde de 6 px a 2×). Las tablas del estante miden 12×12 y se cortan
  en 4 (borde de 8 px): esquinas redondeadas por escalones y un labio grueso abajo, estilo arcade.
*/

const FRAME_PALETTE: Readonly<Record<string, string>> = {
  o: '#2e1a0d',   // contorno
  H: '#d9944f',   // luz de la madera
  w: '#a8693a',   // madera (igual que --sw-wood)
  D: '#6e4021',   // sombra de la madera
  r: '#e0a35a',   // canto claro del marco de pergamino
  R: '#8a5228',   // canto oscuro
  k: '#6e4021',   // filete interior
  // Tabla del estante
  L: '#f2bd78',   // luz
  l: '#d9944f',   // canto claro
  p: '#b9773f',   // madera (igual que el fondo de .plank)
  S: '#7a4524',   // sombra
  s: '#4f2a15',   // labio inferior
};

const FRAMES: Readonly<Record<string, readonly string[]>> = {
  wood: [
    '.ooooooo.',
    'oHHHHHHHo',
    'oHwwwwwDo',
    'oHw...wDo',
    'oHw...wDo',
    'oHw...wDo',
    'oHwwwwwDo',
    'oDDDDDDDo',
    '.ooooooo.',
  ],
  'wood-pressed': [
    '.ooooooo.',
    'oDDDDDDDo',
    'oDwwwwwHo',
    'oDw...wHo',
    'oDw...wHo',
    'oDw...wHo',
    'oDwwwwwHo',
    'oHHHHHHHo',
    '.ooooooo.',
  ],
  plank: [
    '..oooooooo..',
    '.oLLLLLLLLo.',
    'oLLlllllllSo',
    'oLlpppppppSo',
    'oLlpppppppSo',
    'oLlpppppppSo',
    'oLlpppppppSo',
    'oLlpppppppSo',
    'oLlpppppppSo',
    'oSSSSSSSSSSo',
    '.osssssssso.',
    '..oooooooo..',
  ],
  'plank-pressed': [
    '..oooooooo..',
    '.osssssssso.',
    'osSSSSSSSSpo',
    'osSppppppppo',
    'osSppppppppo',
    'osSppppppppo',
    'osSppppppppo',
    'osSppppppppo',
    'osSppppppppo',
    'oppppppppppo',
    '.oLLLLLLLLo.',
    '..oooooooo..',
  ],
  parchment: [
    '.ooooooo.',
    'orrrrrrro',
    'orkkkkkRo',
    'ork...kRo',
    'ork...kRo',
    'ork...kRo',
    'orkkkkkRo',
    'oRRRRRRRo',
    '.ooooooo.',
  ],
};

function toDataUri(rows: readonly string[]): string {
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      const fill = FRAME_PALETTE[row[x]];
      if (fill) rects += `<rect x='${x}' y='${y}' width='${end - x}' height='1' fill='${fill}'/>`;
      x = end;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${rows[0].length}' height='${rows.length}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Variables CSS con los marcos: { '--sw-frame-wood': 'url(...)', ... } */
export const FRAME_VARS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FRAMES).map(([name, rows]) => [`--sw-frame-${name}`, toDataUri(rows)]),
);
