// Las ocho arenas del jugador (análisis funcional §7). Ilimitadas; el efecto llega en la fase 2.

export const Sand = {
  BRASA: 'brasa',
  DUNA: 'duna',
  HUMUS: 'humus',
  MANANTIAL: 'manantial',
  ESCARCHA: 'escarcha',
  DESPERTAR: 'despertar',
  MAREA: 'marea',
  AFINIDAD: 'afinidad',
} as const;

export type SandId = (typeof Sand)[keyof typeof Sand];

/** Orden en el panel de arenas */
export const SAND_ORDER: readonly SandId[] = [
  Sand.BRASA, Sand.DUNA, Sand.HUMUS, Sand.MANANTIAL,
  Sand.ESCARCHA, Sand.DESPERTAR, Sand.MAREA, Sand.AFINIDAD,
];
