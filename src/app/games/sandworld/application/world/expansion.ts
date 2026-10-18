import { ExplorationMap } from './exploration';

/**
 * Siguiente chunk a descubrir: anillos alrededor de la isla inicial, empezando por los vecinos
 * de lado (no de esquina) y, entre ellos, los que quedan delante de la cámara isométrica.
 * Las reglas de cuándo se descubre (subir de nivel) llegan en la fase 7.
 */
export function nextChunkToReveal(exploration: ExplorationMap, maxRing = 8): { cx: number; cy: number } | null {
  for (let ring = 1; ring <= maxRing; ring++) {
    for (const c of ringOrder(ring)) {
      if (!exploration.isRevealed(c.cx, c.cy)) return c;
    }
  }
  return null;
}

/**
 * Chunks de un anillo: primero los que comparten un lado entero con el anillo anterior
 * (menor |cx| + |cy|; las diagonales solo tocan por una esquina y parecerían islas sueltas)
 * y, entre ellos, los de delante de la cámara (mayor cx + cy).
 */
function ringOrder(ring: number): { cx: number; cy: number }[] {
  const cells: { cx: number; cy: number }[] = [];
  for (let cy = -ring; cy <= ring; cy++) {
    for (let cx = -ring; cx <= ring; cx++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) === ring) cells.push({ cx, cy });
    }
  }
  const manhattan = (c: { cx: number; cy: number }): number => Math.abs(c.cx) + Math.abs(c.cy);
  return cells.sort((a, b) => manhattan(a) - manhattan(b) || b.cx + b.cy - (a.cx + a.cy) || a.cy - b.cy);
}
