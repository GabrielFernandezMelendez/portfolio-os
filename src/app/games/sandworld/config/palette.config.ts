// Paleta base del juego. Los colores del terreno (rampas por bioma) llegan en el bloque 2.
// Se guardan como número 0xRRGGBB porque es el formato que usa PixiJS.

export const SKY = {
  day: 0x8fd0f0,
  night: 0x1c2342,
} as const;

// Tinte que se aplica al mundo de noche
export const NIGHT_TINT = 0x5a66a8;
