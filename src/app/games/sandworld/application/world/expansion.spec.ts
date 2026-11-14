import { ExplorationMap } from './exploration';
import { nextPlotToReveal } from './expansion';

/** Descubre `count` parcelas seguidas y devuelve el orden (de chunks) */
function grow(count: number, map = new ExplorationMap()): string[] {
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    for (const c of nextPlotToReveal(map)!) {
      order.push(`${c.cx},${c.cy}`);
      map.reveal(c.cx, c.cy);
    }
  }
  return order;
}

describe('Exploración y expansión', () => {
  it('al empezar está descubierta la primera parcela (2×2 chunks)', () => {
    const map = new ExplorationMap();
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(map.isRevealed(cx, cy)).toBe(true);
    expect(map.isRevealed(2, 0)).toBe(false);
    expect(map.list().length).toBe(4);
  });

  it('descubrir dos veces el mismo chunk no hace nada la segunda vez', () => {
    const map = new ExplorationMap();
    expect(map.reveal(2, 0)).toBe(true);
    expect(map.reveal(2, 0)).toBe(false);
    expect(map.list().length).toBe(5);
  });

  it('crece de parcela en parcela (4 chunks cada vez) y en cuadrados: 4×4 chunks al nivel 4, 6×6 al nivel 9', () => {
    const order = grow(8);
    expect(order.length).toBe(32);
    expect(order.slice(0, 4)).toEqual(['2,0', '3,0', '2,1', '3,1']);
    const square = (n: number): boolean => order.slice(0, n * n - 4).every(k => k.split(',').every(v => Number(v) < n));
    expect(square(4)).toBe(true);
    expect(square(6)).toBe(true);
  });

  it('cada parcela nueva comparte un lado entero con lo ya descubierto (sin piezas sueltas)', () => {
    const map = new ExplorationMap();
    for (let i = 0; i < 12; i++) {
      const plot = nextPlotToReveal(map)!;
      const sharesSide = plot.some(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.isRevealed(c.cx + dx, c.cy + dy)));
      expect(sharesSide).toBe(true);
      for (const c of plot) map.reveal(c.cx, c.cy);
    }
  });
});
