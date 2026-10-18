import { CarConfig, CarSprite } from '../domain/car.model';

// Pixel grid legend:
// B = body, D = body light, S = spoiler/dark accent
// W = outline/wheels, A = accent stripe
// G = glass (windshield), R = taillight, . = transparent

const BASE_SPRITE_PIXELS: readonly string[] = [
  '...SBBBS...',
  '..SBBBBBS..',
  '..BBBBBBB..',
  '.WBBBBBBBW.',
  '.WBDDDDDBW.',
  'WWBDDDDDBWW',
  'WBBDAADDBBW',
  'WBBDDDDDBW.',
  'WBBBBBBBBBW',
  'WBBBBBBBBBW',
  'WBBDDDDDBW.',
  'WBBDDDDDBWW',
  'WWBDDDDDBWW',
  '.WBGGGGDBW.',
  '.WBBBBBBBW.',
  '..BBBBBBB..',
  '..BBRRRBB..',
  '...BBBBB...',
];

const BASE_COLOR_MAP: Record<string, string> = {
  B: 'body',
  D: 'body',
  S: 'outline',
  W: 'wheels',
  A: 'accent',
  G: 'glass',
  R: 'taillight',
};

const BASE_SPRITE: CarSprite = {
  width: 11,
  height: 18,
  pixels: BASE_SPRITE_PIXELS,
  colorMap: BASE_COLOR_MAP,
};

export const CARS_CONFIG: readonly CarConfig[] = [
  {
    id: 'fury',
    name: 'Fury',
    colors: {
      body: '#e63946', bodyDark: '#cc2233',
      accent: '#ffd700', outline: '#222',
      wheels: '#111', glass: '#4488cc',
      glassGlint: '#aaddff', taillight: '#ff3333',
    },
    sprite: BASE_SPRITE,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    colors: {
      body: '#e2e2ea', bodyDark: '#c8c8d0',
      accent: '#e63946', outline: '#222',
      wheels: '#333', glass: '#4488cc',
      glassGlint: '#aaddff', taillight: '#ff3333',
    },
    sprite: BASE_SPRITE,
  },
  {
    id: 'storm',
    name: 'Storm',
    colors: {
      body: '#3b82f6', bodyDark: '#1d4ed8',
      accent: '#ffffff', outline: '#111',
      wheels: '#0f1729', glass: '#60a5fa',
      glassGlint: '#aaddff', taillight: '#ff3333',
    },
    sprite: BASE_SPRITE,
  },
  {
    id: 'thunder',
    name: 'Thunder',
    colors: {
      body: '#eab308', bodyDark: '#ca8a04',
      accent: '#111111', outline: '#222',
      wheels: '#2a2008', glass: '#4488cc',
      glassGlint: '#aaddff', taillight: '#ff3333',
    },
    sprite: BASE_SPRITE,
  },
  {
    id: 'venom',
    name: 'Venom',
    colors: {
      body: '#22c55e', bodyDark: '#15803d',
      accent: '#ffffff', outline: '#0a2e15',
      wheels: '#0a1a0f', glass: '#4488cc',
      glassGlint: '#aaddff', taillight: '#ff3333',
    },
    sprite: BASE_SPRITE,
  },
];