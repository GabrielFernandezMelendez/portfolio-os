// Materiales del terreno. Se guardan como número (Uint8Array) en cada celda del chunk.
// Para añadir uno: nuevo id aquí + su definición en config/materials.config.ts (y su rampa de color si la necesita).

export const Material = {
  ROCK:    0,
  SOIL:    1,
  SAND:    2,
  HUMUS:   3,
  ASH:     4,
  MUD:     5,
  SNOW:    6,
  ICE:     7,
  PEAT:    8,   // turba: fondo del pantano viejo
  CHARRED: 9,   // suelo calcinado: Tierra Quemada
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

/**
 * Propiedades físicas de un material (valores relativos, ver análisis funcional §5.2).
 * - weight:       densidad relativa (agua = 1)
 * - repose:       desnivel máximo entre celdas vecinas (en niveles) antes de desprenderse; Infinity = no se desliza
 * - permeability: fracción del agua de encima que absorbe
 * - retention:    humedad que conserva al secarse (0..1)
 * - erosion:      facilidad con que el agua corriente lo arrastra
 * - fertility:    fertilidad que aporta al suelo
 * - fuel:         cuánto alimenta un fuego (0 = no arde)
 * - maxLoad:      peso de animal que aguanta sin hundirse (Infinity = firme); lo usa la fauna en la fase 4
 * - flow:         velocidad relativa del agua que corre por encima (roca rápida, barro lento)
 */
export interface MaterialProps {
  readonly weight: number;
  readonly repose: number;
  readonly permeability: number;
  readonly retention: number;
  readonly erosion: number;
  readonly fertility: number;
  readonly fuel: number;
  readonly maxLoad: number;
  readonly flow: number;
}

/** Definición completa: física + aspecto (nombres de rampas de config/palette.config.ts) */
export interface MaterialDef extends MaterialProps {
  readonly key: string;
  /** Rampa de la cara superior; sin rampa usa la del bioma (la tierra) */
  readonly ramp?: string;
  /** Paredes; sin paredes propias usa las del bioma */
  readonly wall?: string;
}
