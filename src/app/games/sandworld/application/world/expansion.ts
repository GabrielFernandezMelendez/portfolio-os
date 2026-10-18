import { ExplorationMap } from './exploration';

/**
 * Siguiente chunk a descubrir: la isla crece en cuadrados desde el chunk (0,0).
 *
 *   1×1 → 2×2 → 3×3 → 4×4 ...
 *
 * Para pasar del cuadrado (n-1)×(n-1) al n×n se añade primero la columna nueva (cx = n-1) y después
 * la fila nueva (cy = n-1). Así, en cada paso la isla es un rectángulo o un cuadrado con una tira
 * a medias: nunca queda en forma de L ni con piezas sueltas. Crece hacia la cámara (cx y cy positivos),
 * de modo que lo nuevo aparece siempre por delante.
 *
 *   orden de aparición (cx →, cy ↓):
 *      1  2  5 10
 *      3  4  6 11
 *      7  8  9 12
 *     13 14 15 16
 *
 * Las reglas de cuándo se descubre (subir de nivel) llegan en la fase 7.
 */
export function nextChunkToReveal(exploration: ExplorationMap, maxSize = 16): { cx: number; cy: number } | null {
  for (let n = 1; n <= maxSize; n++) {
    for (const c of squareGrowth(n)) {
      if (!exploration.isRevealed(c.cx, c.cy)) return c;
    }
  }
  return null;
}

/** Chunks que convierten el cuadrado (n-1)×(n-1) en n×n: columna nueva y después fila nueva */
export function squareGrowth(n: number): { cx: number; cy: number }[] {
  const k = n - 1;
  const cells: { cx: number; cy: number }[] = [];
  for (let cy = 0; cy < k; cy++) cells.push({ cx: k, cy });
  for (let cx = 0; cx <= k; cx++) cells.push({ cx, cy: k });
  return cells;
}
