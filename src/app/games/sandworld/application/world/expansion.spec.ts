import { ExplorationMap } from './exploration';
import { nextChunkToReveal } from './expansion';

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

  it('se descubre por anillos: primero los vecinos de lado (delante antes), luego las diagonales', () => {
    const map = new ExplorationMap();
    const order: string[] = [];
    for (let i = 0; i < 8; i++) {
      const c = nextChunkToReveal(map)!;
      order.push(`${c.cx},${c.cy}`);
      map.reveal(c.cx, c.cy);
    }
    // Los 4 primeros comparten lado con la isla; los dos de delante de la cámara van primero
    expect(order.slice(0, 2)).toEqual(['1,0', '0,1']);
    expect(order.slice(0, 4).every(k => k.split(',').map(Number).reduce((s, n) => s + Math.abs(n), 0) === 1)).toBe(true);
    expect(new Set(order).size).toBe(8);
    expect(order.every(k => k.split(',').every(n => Math.abs(Number(n)) <= 1))).toBe(true);
    // Lleno el anillo 1, el siguiente ya es del anillo 2
    const next = nextChunkToReveal(map)!;
    expect(Math.max(Math.abs(next.cx), Math.abs(next.cy))).toBe(2);
  });
});
