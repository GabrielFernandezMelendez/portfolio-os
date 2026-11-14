import { findPath } from './pathfinding';

describe('Rutas de la fauna', () => {
  /** Rejilla de 20 × 20 con una pared en x = 10 (de y = 0 a 16): hay que rodearla por abajo */
  const wall = (x: number, y: number) => x === 10 && y <= 16;
  const pass = (x: number, y: number) => (x >= 0 && y >= 0 && x < 20 && y < 20 && !wall(x, y) ? 0 : NaN);

  it('rodea una pared y devuelve solo los puntos donde gira', () => {
    const path = findPath(5, 5, 15, 5, pass, 1.3, 2000)!;
    expect(path).not.toBeNull();
    const pts: [number, number][] = [];
    for (let i = 0; i < path.length; i += 2) pts.push([path[i], path[i + 1]]);
    expect(pts[pts.length - 1]).toEqual([15.5, 5.5]);
    expect(pts.some(([, y]) => y > 16)).toBe(true);
    expect(pts.length).toBeLessThan(8);
  });

  it('sin camino posible: llega lo más cerca que pueda si acerca de verdad; si no, null', () => {
    const closed = (x: number, y: number) => (x === 10 ? NaN : pass(x, y));
    const near = findPath(2, 5, 15, 5, closed, 1.3, 2000)!;
    expect(near[near.length - 2]).toBe(9.5);
    expect(findPath(9, 5, 15, 5, closed, 1.3, 2000)).toBeNull();
  });

  it('no sube terrazas más altas que un paso', () => {
    // Una meseta 3 niveles más alta en x >= 10, con una rampa (altura 1 y 2) solo por y = 18..19
    const terrace = (x: number, y: number) => (x < 0 || y < 0 || x >= 20 || y >= 20 ? NaN : x < 10 ? 0 : y >= 18 ? Math.min(3, x - 9) : 3);
    const path = findPath(5, 5, 15, 5, terrace, 1.3, 2000)!;
    const ys = path.filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(18);
  });
});
