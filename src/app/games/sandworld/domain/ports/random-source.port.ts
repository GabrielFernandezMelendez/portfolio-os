/**
 * Puerto de aleatoriedad.
 * Todo el azar del juego pasa por aquí para que, con la misma semilla, el mundo se comporte igual
 * (reproducible para depurar y para los tests).
 */
export interface RandomSource {
  /** Número en [0, 1) */
  next(): number;
}
