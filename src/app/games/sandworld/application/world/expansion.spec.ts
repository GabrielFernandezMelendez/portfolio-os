import { ExplorationMap } from './exploration';
import { nextChunkToReveal } from './expansion';

/** Descubre `count` chunks seguidos y devuelve el orden */
function grow(count: number, map = new ExplorationMap()): string[] {
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = nextChunkToReveal(map)!;
    order.push(`${c.cx},${c.cy}`);
    map.reveal(c.cx, c.cy);
  }
  return order;
}

describe('Exploración y expansión', () => {
  it('al empezar solo está descubierto el chunk (0,0)', () => {
    const map = new ExplorationMap();
    expect(map.isRevealed(0, 0)).toBe(true);
    expect(map.isRevealed(1, 0)).toBe(false);
    expect(map.list()).toEqual([{ cx: 0, cy: 0 }]);
  });

  it('descubrir dos veces el mismo chunk no hace nada la segunda vez', () => {
    const map = new ExplorationMap();
    expect(map.reveal(1, 0)).toBe(true);
    expect(map.reveal(1, 0)).toBe(false);
    expect(map.list().length).toBe(2);
  });

  it('crece en cuadrados: 2×2 al nivel 4, 3×3 al nivel 9, 4×4 al nivel 16', () => {
    const order = grow(15);                         // + el (0,0) inicial = 16 chunks
    expect(order.slice(0, 3)).toEqual(['1,0', '0,1', '1,1']);
    expect(order.slice(3, 8)).toEqual(['2,0', '2,1', '0,2', '1,2', '2,2']);
    const square = (n: number): boolean => order.slice(0, n * n - 1).every(k => k.split(',').every(v => Number(v) < n));
    expect(square(2)).toBe(true);
    expect(square(3)).toBe(true);
    expect(square(4)).toBe(true);
  });

  it('cada chunk nuevo comparte un lado entero con alguno ya descubierto (sin piezas sueltas)', () => {
    const map = new ExplorationMap();
    for (let i = 0; i < 24; i++) {
      const c = nextChunkToReveal(map)!;
      const sharesSide = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.isRevealed(c.cx + dx, c.cy + dy));
      expect(sharesSide).toBe(true);
      map.reveal(c.cx, c.cy);
    }
  });
});
