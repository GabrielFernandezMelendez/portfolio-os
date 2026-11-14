// Biomas emergentes. Se guardan como número (Uint8Array) en cada tile del chunk.
// Qué condiciones tiene cada uno, cómo se dibuja y en qué orden se comprueba está en config/biomes.config.ts.

export const Biome = {
  FOREST:   0,
  DESERT:   1,
  TUNDRA:   2,
  WETLAND:  3,
  SWAMP:    4,
  ROCKLAND: 5,
  BURNT:    6,
  GLADE:    7,   // Claro Despierto
} as const;

export type BiomeId = (typeof Biome)[keyof typeof Biome];

/**
 * Lo que se sabe de un tile para decidir su bioma (medias y fracciones de sus 16 celdas).
 * Las fracciones van de 0 a 1: qué parte de las celdas del tile cumple algo.
 */
export interface TileContext {
  readonly temperature: number;
  readonly humidity: number;
  /** Celdas con agua visible (> 0,05) */
  readonly water: number;
  /** Humedad media del suelo */
  readonly moisture: number;
  readonly mud: number;
  readonly sand: number;
  readonly ash: number;
  readonly charred: number;
  /** Roca desnuda: sin sedimento ni capa helada encima */
  readonly rock: number;
  /** Nieve o hielo encima */
  readonly cover: number;
  readonly fertility: number;
  readonly essence: number;
  readonly affinity: number;
  /** El tile tiene un Claro Despierto (lo decide la regla del claro, no el clima) */
  readonly glade: boolean;
}

/** Un bioma del registro */
export interface BiomeDef {
  readonly id: BiomeId;
  /** Clave para textos (i18n) y para depurar */
  readonly key: string;
  /** Se comprueban de mayor a menor prioridad: gana el primero cuyas condiciones se cumplen */
  readonly priority: number;
  /** ¿Este tile cumple las condiciones del bioma? (el bosque, por defecto, siempre) */
  readonly when: (ctx: TileContext) => boolean;
  /** Cambia en el momento, sin esperar días (nace de un suceso: un claro que despierta, un suelo calcinado) */
  readonly instant?: boolean;
  /** Rampa de la cara superior y paredes (claves de TERRAIN_RAMPS y TERRAIN_WALLS) */
  readonly ramp: string;
  readonly wall: string;
  /** Rampa del agua, si no es la normal (el pantano tiene agua turbia) */
  readonly water?: string;
  /** Destellos sueltos en el suelo (colores 0xRRGGBB) y su densidad (0..1) */
  readonly sparkle?: { readonly colors: readonly number[]; readonly density: number };
  /** Fertilidad que impone al nacer (si no se indica, se conserva la que tenía el tile) */
  readonly fertility?: number;
  /** Peso de su fertilidad en la vegetación provisional (hasta la fase 4) */
  readonly vegetation: number;
}
