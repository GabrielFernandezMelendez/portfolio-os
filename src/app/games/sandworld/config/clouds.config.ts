// Nubes (ajustables en la ronda de pulido)

/** Velocidad del viento: px de mundo por segundo del mar de nubes y de la capa alta */
export const CLOUD_SEA_SPEED = 3;
export const CLOUD_WISP_SPEED = 8;

/** Opacidad de la capa alta de copos */
export const CLOUD_WISP_ALPHA = 0.85;

/** Cuánto se extiende el mar de nubes alrededor del mundo descubierto (px de mundo) */
export const CLOUD_SEA_MARGIN = 1200;

/** Margen extra de cámara para asomarse al mar de nubes (px de mundo) */
export const CLOUD_CAMERA_MARGIN = 70;

/** Duración (ms reales) de la aparición de un chunk entre las nubes */
export const REVEAL_MS = 3800;

/** Cuánto sube el chunk al emerger (px de mundo) */
export const REVEAL_RISE = 56;

/** La isla inicial también emerge de las nubes al abrir el juego */
export const REVEAL_ON_START = true;
