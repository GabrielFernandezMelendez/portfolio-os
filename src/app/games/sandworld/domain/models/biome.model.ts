// Biomas emergentes. Se guardan como número (Uint8Array) en cada tile del chunk.

export const Biome = {
  FOREST:  0,
  DESERT:  1,
  TUNDRA:  2,
  WETLAND: 3,
} as const;

export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** Bioma de tierra a partir de temperatura y humedad (0..1). El humedal lo decide el agua, no el clima. */
export function landBiomeOf(temperature: number, humidity: number): BiomeId {
  if (temperature < 0.34) return Biome.TUNDRA;
  if (temperature > 0.64 && humidity < 0.5) return Biome.DESERT;
  return Biome.FOREST;
}
