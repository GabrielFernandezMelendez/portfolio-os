// Ajustes del juego que no dependen de ningún framework

export type SandworldLang = 'es' | 'en';

export const SANDWORLD_LANGS: readonly SandworldLang[] = ['es', 'en'];

export const DEFAULT_LANG: SandworldLang = 'es';

// Velocidades de simulación disponibles (x1, x2, x4)
export type SimSpeed = 1 | 2 | 4;

export const SIM_SPEEDS: readonly SimSpeed[] = [1, 2, 4];
