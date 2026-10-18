import { isoToWorld, worldToIso } from './iso';

describe('iso', () => {
  it('worldToIso deshace isoToWorld a cualquier altura', () => {
    for (const [u, v, l] of [[0, 0, 0], [3.25, 6.5, 2], [7, 1, 7], [-2, 9.75, 4.5]]) {
      const p = isoToWorld(u, v, l);
      const back = worldToIso(p.x, p.y, l);
      expect(back.x).toBeCloseTo(u, 6);
      expect(back.y).toBeCloseTo(v, 6);
    }
  });

  it('cada nivel sube la imagen LEVEL_PX píxeles', () => {
    expect(isoToWorld(2, 3, 0).y - isoToWorld(2, 3, 1).y).toBe(5);
  });
});
