import { ExplorationMap } from './exploration';
import { PLOT } from '../../config/island.config';

/**
 * Siguiente parcela a descubrir: la isla crece en cuadrados de parcelas desde la (0,0). Cada parcela es un
 * cuadrado de PLOT × PLOT chunks (config/island.config.ts).
 *
 *   1×1 → 2×2 → 3×3 → 4×4 ... (en parcelas; con PLOT = 2, en chunks: 2×2 → 4×4 → 6×6 → 8×8)
 *
 * Para pasar del cuadrado (n-1)×(n-1) al n×n se añade primero la columna nueva (px = n-1) y después
 * la fila nueva (py = n-1). Así, en cada paso la isla es un rectángulo o un cuadrado con una tira
 * a medias: nunca queda en forma de L ni con piezas sueltas. Crece hacia la cámara (x e y positivos),
 * de modo que lo nuevo aparece siempre por delante.
 *
 *   orden de aparición (px →, py ↓):
 *      1  2  5 10
 *      3  4  6 11
 *      7  8  9 12
 *     13 14 15 16
 *
 * Devuelve los chunks de la parcela (o null si la isla ya está entera). Las reglas de cuándo se descubre (subir de
 * nivel) llegan en la fase 7.
 */
export function nextPlotToReveal(exploration: ExplorationMap, maxSize = 8, plot = PLOT): { cx: number; cy: number }[] | null {
  for (let n = 1; n <= maxSize; n++) {
    for (const p of squareGrowth(n)) {
      const chunks = plotChunks(p.cx, p.cy, plot);
      if (chunks.some(c => !exploration.isRevealed(c.cx, c.cy))) return chunks;
    }
  }
  return null;
}

/** Chunks de la parcela (px, py) */
export function plotChunks(px: number, py: number, plot = PLOT): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = [];
  for (let dy = 0; dy < plot; dy++) for (let dx = 0; dx < plot; dx++) out.push({ cx: px * plot + dx, cy: py * plot + dy });
  return out;
}

/** Celdas (parcelas) que convierten el cuadrado (n-1)×(n-1) en n×n: columna nueva y después fila nueva */
export function squareGrowth(n: number): { cx: number; cy: number }[] {
  const k = n - 1;
  const cells: { cx: number; cy: number }[] = [];
  for (let cy = 0; cy < k; cy++) cells.push({ cx: k, cy });
  for (let cx = 0; cx <= k; cx++) cells.push({ cx, cy: k });
  return cells;
}
