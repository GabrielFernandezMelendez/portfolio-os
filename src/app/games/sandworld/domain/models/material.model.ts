// Materiales del terreno. Se guardan como número (Uint8Array) en cada celda del chunk.

export const Material = {
  ROCK:  0,
  SOIL:  1,
  SAND:  2,
  HUMUS: 3,
  ASH:   4,
  MUD:   5,
  SNOW:  6,
  ICE:   7,
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

/**
 * Propiedades físicas de un material (valores relativos, ver análisis funcional §5.2).
 * - weight:       densidad relativa (agua = 1)
 * - repose:       desnivel máximo entre celdas vecinas (en niveles) antes de desprenderse; Infinity = no se desliza
 * - permeability: fracción del agua de encima que absorbe
 * - retention:    humedad que conserva al secarse
 * - erosion:      facilidad con que el agua corriente lo arrastra
 * - fertility:    fertilidad que aporta al suelo
 */
export interface MaterialProps {
  readonly weight: number;
  readonly repose: number;
  readonly permeability: number;
  readonly retention: number;
  readonly erosion: number;
  readonly fertility: number;
}
