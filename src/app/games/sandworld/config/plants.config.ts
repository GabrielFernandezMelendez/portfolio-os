import { PlantDef } from '../domain/models/plant.model';
import { Season } from '../domain/models/time.model';

/*
  Registro de plantas [PROPUESTA]: 20 plantas con valores de partida para afinar jugando.
  Añadir una = una entrada aquí (id siguiente), su sprite en rendering/vegetation/plant-sprites.ts
  y su nombre en i18n (plant.<key>). La simulación, el dibujo y (más adelante) la fauna lo leen todo de aquí.
  Biomas: forest, desert, tundra, wetland, swamp, rockland, burnt, glade.
*/
export const PLANT_DEFS: readonly PlantDef[] = [
  // ── Pequeñas ──
  { id: 0, key: 'grass', kind: 'small', biomes: { forest: 1, wetland: 0.5, glade: 0.6, desert: 0.15, tundra: 0.2, swamp: 0.2 },
    growthDays: 5, spread: 0.3, temperature: [0.2, 0.85], moisture: 0.1, fertility: 0.15, fuel: 0.9, autumn: true, sprites: 2,
    food: { nutrition: 0.25, diets: ['grazer', 'omnivore'] } },
  { id: 1, key: 'clover', kind: 'small', biomes: { forest: 0.5, glade: 0.5, wetland: 0.3 },
    growthDays: 6, spread: 0.2, temperature: [0.3, 0.75], moisture: 0.2, fertility: 0.3, fuel: 0.5, autumn: true, sprites: 1,
    food: { nutrition: 0.4, diets: ['grazer', 'omnivore'] } },
  { id: 2, key: 'rockMoss', kind: 'small', biomes: { rockland: 1, tundra: 0.5, forest: 0.1 }, rock: true, snow: true,
    growthDays: 20, spread: 0.08, temperature: [0, 0.7], moisture: 0.05, fertility: 0, fuel: 0.2, sprites: 1,
    food: { nutrition: 0.1, diets: ['grazer'] } },
  { id: 3, key: 'reed', kind: 'small', biomes: { wetland: 1, swamp: 0.9, forest: 0.15 }, shore: true,
    growthDays: 6, spread: 0.25, temperature: [0.25, 0.9], moisture: 0.5, fertility: 0.2, fuel: 0.2, autumn: true, sprites: 2,
    food: { nutrition: 0.2, diets: ['bird', 'grazer'] } },
  { id: 4, key: 'thistle', kind: 'small', biomes: { desert: 0.8, forest: 0.15 },
    growthDays: 8, spread: 0.12, temperature: [0.4, 1], moisture: 0, fertility: 0, fuel: 0.6, sprites: 1, hurts: 0.05,
    food: { nutrition: 0.2, diets: ['grazer', 'browser'] } },
  { id: 5, key: 'sage', kind: 'small', biomes: { forest: 0.3, desert: 0.3 },
    growthDays: 10, spread: 0.08, temperature: [0.35, 0.9], moisture: 0.05, fertility: 0.15, fuel: 0.7, sprites: 1, medicinal: 0.6,
    food: { nutrition: 0.1, diets: ['grazer', 'omnivore'] } },
  { id: 6, key: 'swampShroom', kind: 'small', biomes: { swamp: 1, wetland: 0.2, forest: 0.05 },
    growthDays: 4, spread: 0.2, temperature: [0.25, 0.8], moisture: 0.5, fertility: 0.3, fuel: 0.1, sprites: 1,
    food: { nutrition: 0.6, diets: ['omnivore', 'browser'] }, toxic: { effect: 'confused', chance: 0.3 } },
  { id: 7, key: 'snowLichen', kind: 'small', biomes: { tundra: 1, rockland: 0.3 }, rock: true, snow: true,
    growthDays: 25, spread: 0.06, temperature: [0, 0.5], moisture: 0, fertility: 0, fuel: 0.3, sprites: 1,
    food: { nutrition: 0.2, diets: ['grazer'], seasons: [Season.AUTUMN, Season.WINTER] } },
  { id: 8, key: 'glowFlower', kind: 'small', biomes: { glade: 1 }, gladeOnly: true,
    growthDays: 6, spread: 0.1, temperature: [0.2, 0.85], moisture: 0.1, fertility: 0.5, fuel: 0, sprites: 2, essence: 0.01,
    food: { nutrition: 0.3, diets: ['bird', 'grazer'] } },
  // ── Arbustos ──
  { id: 9, key: 'redBerries', kind: 'bush', biomes: { forest: 0.5, glade: 0.4 },
    growthDays: 15, spread: 0.05, temperature: [0.3, 0.8], moisture: 0.15, fertility: 0.35, fuel: 0.5, autumn: true, sprites: 1,
    food: { nutrition: 0.5, diets: ['frugivore', 'bird', 'omnivore'], seasons: [Season.SUMMER, Season.AUTUMN] } },
  { id: 10, key: 'blueberry', kind: 'bush', biomes: { wetland: 0.5, glade: 0.6, forest: 0.15 },
    growthDays: 18, spread: 0.03, temperature: [0.3, 0.7], moisture: 0.4, fertility: 0.6, fuel: 0.4, autumn: true, sprites: 1,
    food: { nutrition: 0.85, diets: ['frugivore', 'bird', 'omnivore'], seasons: [Season.SUMMER, Season.AUTUMN] } },
  { id: 11, key: 'shadeBerries', kind: 'bush', biomes: { forest: 0.25 },
    growthDays: 15, spread: 0.04, temperature: [0.3, 0.75], moisture: 0.2, fertility: 0.3, fuel: 0.5, sprites: 1,
    food: { nutrition: 0.5, diets: ['frugivore', 'bird', 'omnivore'], seasons: [Season.SUMMER, Season.AUTUMN] },
    toxic: { effect: 'lethal', chance: 1 } },
  { id: 12, key: 'bramble', kind: 'bush', biomes: { forest: 0.35, glade: 0.1 },
    growthDays: 12, spread: 0.06, temperature: [0.25, 0.85], moisture: 0.1, fertility: 0.2, fuel: 0.7, sprites: 1,
    refuge: true, hurts: 0.15 },
  { id: 13, key: 'vine', kind: 'bush', biomes: { forest: 0.3, wetland: 0.3 },
    growthDays: 8, spread: 0.12, temperature: [0.35, 0.9], moisture: 0.35, fertility: 0.4, fuel: 0.6, autumn: true, sprites: 1,
    invasive: 0.02, food: { nutrition: 0.15, diets: ['browser', 'grazer'] } },
  { id: 14, key: 'cactus', kind: 'bush', biomes: { desert: 1 },
    growthDays: 25, spread: 0.03, temperature: [0.5, 1], moisture: 0, fertility: 0, fuel: 0.1, sprites: 1, hurts: 0.1,
    drink: 0.5, food: { nutrition: 0.3, diets: ['browser', 'omnivore'] } },
  // ── Árboles ──
  { id: 15, key: 'oak', kind: 'tree', biomes: { forest: 0.8, glade: 0.3 },
    growthDays: 30, spread: 0.02, temperature: [0.3, 0.75], moisture: 0.2, fertility: 0.4, fuel: 0.4, deciduous: true, autumn: true,
    sprites: 1, shade: 0.05, roots: 0.6, food: { nutrition: 0.6, diets: ['frugivore', 'omnivore', 'browser'], seasons: [Season.AUTUMN] } },
  { id: 16, key: 'pine', kind: 'tree', biomes: { tundra: 1, forest: 0.25 }, snow: true,
    growthDays: 30, spread: 0.02, temperature: [0.05, 0.6], moisture: 0.1, fertility: 0.15, fuel: 1, sprites: 1, shade: 0.03, roots: 0.5,
    food: { nutrition: 0.35, diets: ['frugivore', 'bird', 'omnivore'], seasons: [Season.WINTER] } },
  { id: 17, key: 'appleTree', kind: 'tree', biomes: { forest: 0.3, glade: 0.3 },
    growthDays: 30, spread: 0.015, temperature: [0.35, 0.75], moisture: 0.25, fertility: 0.5, fuel: 0.4, deciduous: true, autumn: true,
    sprites: 1, shade: 0.04, roots: 0.5,
    food: { nutrition: 0.9, diets: ['frugivore', 'omnivore', 'browser'], seasons: [Season.SUMMER, Season.AUTUMN] } },
  { id: 18, key: 'willow', kind: 'tree', biomes: { wetland: 0.8, swamp: 0.2, forest: 0.1 }, shore: true,
    growthDays: 30, spread: 0.02, temperature: [0.25, 0.8], moisture: 0.45, fertility: 0.3, fuel: 0.3, deciduous: true, autumn: true,
    sprites: 1, shade: 0.05, roots: 1, medicinal: 0.3, food: { nutrition: 0.15, diets: ['browser'] } },
  { id: 19, key: 'deadTree', kind: 'tree', biomes: { swamp: 1, desert: 0.15, forest: 0.05 },
    growthDays: 30, spread: 0.01, temperature: [0, 1], moisture: 0, fertility: 0, fuel: 1, sprites: 1, roots: 0.2,
    food: { nutrition: 0.3, diets: ['bird'] } },
];

export const PLANT_COUNT = PLANT_DEFS.length;

// ── Simulación ──
/** Cada cuántos minutos de juego se actualiza la vegetación (con los biomas) */
export const VEGETATION_CHECK_MINUTES = 60;
/** Cuánto crece cada estación respecto a la primavera (primavera, verano, otoño, invierno) */
export const SEASON_GROWTH = [1, 0.7, 0.35, 0] as const;
/** Espacio que ocupa cada tipo de planta en un tile (la suma de biomasa × espacio no pasa de 1) */
export const PLANT_SPACE = { small: 0.35, bush: 0.6, tree: 1 } as const;
/** Arena que entierra: niveles de subida del suelo que matan del todo a las pequeñas, a los arbustos y a los árboles */
export const BURY_KILL = { small: 0.3, bush: 0.6, tree: 1.2 } as const;
/** Biomasa mínima para que una planta se considere presente (y se dibuje, y siembre) */
export const PLANT_MIN = 0.05;

// ── Estaciones de los árboles y la hierba (días) ──
/** Lo que tarda cada planta en cambiar de color, perder o recuperar hojas, al azar entre min y max */
export const LEAF_CHANGE_DAYS = [3, 5] as const;
/** Retraso máximo con el que empieza cada planta (para que no cambien todas a la vez) */
export const LEAF_CHANGE_STAGGER_DAYS = 2;
