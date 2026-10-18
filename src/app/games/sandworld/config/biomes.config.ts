import { Biome, BiomeDef, BiomeId, TileContext } from '../domain/models/biome.model';

/*
  Registro de biomas [PROPUESTA]: condiciones de partida para afinar jugando.
  Añadir un bioma = nuevo id en biome.model.ts + una entrada aquí (+ sus textos en i18n y su rampa en la paleta).
  El cálculo, el dibujo y la crónica lo leen todo de aquí.
*/

/**
 * Un tile es "sano" para el Claro Despierto: fértil, húmedo sin encharcar (suelo húmedo o clima húmedo),
 * sin quemar, sin ceniza, sin barro, sin roca desnuda y sin nieve.
 */
export const isHealthy = (c: TileContext): boolean =>
  c.charred < 0.05 && c.ash < 0.2 && c.mud < 0.2 && c.water < 0.2 && c.rock < 0.3 && c.cover < 0.3 &&
  (c.moisture >= 0.15 || c.humidity >= 0.4) && c.fertility >= 0.4;

const DEFS: BiomeDef[] = [
  // Tierra Quemada: suelo calcinado por exceso de Brasa o un gran incendio
  { id: Biome.BURNT, key: 'burnt', priority: 100, when: c => c.charred >= 0.4,
    ramp: 'charred', wall: 'charred', fertility: 0, vegetation: 0, instant: true },
  // Claro Despierto: raro (7,5 %), lo crea la regla del claro y lo mantiene la tierra sana
  { id: Biome.GLADE, key: 'glade', priority: 90, when: c => c.glade && isHealthy(c),
    ramp: 'glade', wall: 'forest', fertility: 1, vegetation: 1.3, instant: true,
    sparkle: { colors: [0x6ff0ff, 0xd890ff, 0xeafffa], density: 0.025 } },
  // Pantano: barro con humedad constante (solo nace del exceso de agua estancada)
  { id: Biome.SWAMP, key: 'swamp', priority: 80, when: c => c.mud >= 0.3 && c.moisture >= 0.5,
    ramp: 'swamp', wall: 'forest', water: 'murky', vegetation: 0.6 },
  // Humedal: mucha agua repartida
  { id: Biome.WETLAND, key: 'wetland', priority: 70, when: c => c.water >= 0.45,
    ramp: 'marsh', wall: 'forest', vegetation: 1 },
  // Roquedal: roca desnuda
  { id: Biome.ROCKLAND, key: 'rockland', priority: 60, when: c => c.rock >= 0.5,
    ramp: 'gravel', wall: 'rock', vegetation: 0.15 },
  // Tundra: frío o cubierto de nieve y hielo
  { id: Biome.TUNDRA, key: 'tundra', priority: 50, when: c => c.cover >= 0.5 || c.temperature < 0.34,
    ramp: 'tundra', wall: 'tundra', vegetation: 0.3 },
  // Desierto: arena seca, o calor sin humedad
  { id: Biome.DESERT, key: 'desert', priority: 40,
    when: c => (c.sand >= 0.5 && c.moisture < 0.3) || (c.temperature > 0.64 && c.humidity < 0.5),
    ramp: 'desert', wall: 'desert', vegetation: 0.3 },
  // Bosque: lo que queda
  { id: Biome.FOREST, key: 'forest', priority: 0, when: () => true,
    ramp: 'forest', wall: 'forest', vegetation: 1 },
];

/** Biomas de mayor a menor prioridad */
export const BIOME_DEFS: readonly BiomeDef[] = [...DEFS].sort((a, b) => b.priority - a.priority);

export const BIOME_BY_ID: Readonly<Record<BiomeId, BiomeDef>> =
  Object.fromEntries(BIOME_DEFS.map(d => [d.id, d])) as Record<BiomeId, BiomeDef>;

/** Bioma que corresponde a un tile ahora mismo */
export function classifyBiome(ctx: TileContext): BiomeId {
  return BIOME_DEFS.find(d => d.when(ctx))!.id;
}

// ── Cambios de bioma ──
/** Cada cuántos minutos de juego se revisan los biomas */
export const BIOME_CHECK_MINUTES = 60;
/** Días seguidos que un tile tiene que cumplir las condiciones de otro bioma para cambiar (evita parpadeos) */
export const BIOME_CHANGE_DAYS = 3;

// ── Claro Despierto ──
/** Esencia y afinidad mínimas en el tile para intentar despertar un claro (cada intento las gasta) */
export const GLADE_MIN_ESSENCE = 0.2;
export const GLADE_MIN_AFFINITY = 0.2;
/** Probabilidad de que un intento (o una expansión) salga bien */
export const GLADE_CHANCE = 0.075;
/** Días de espera entre intentos en el mismo tile */
export const GLADE_RETRY_DAYS = 1;
