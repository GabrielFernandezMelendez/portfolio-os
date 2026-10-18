import { CLOUD_TILE_H, CLOUD_TILE_W, PUFF_H, PUFF_W, bakeCloudPuff, bakeCloudSea, bakeIslandShadow } from './cloud-baker';

describe('cloud-baker', () => {
  const W = CLOUD_TILE_W, H = CLOUD_TILE_H;

  it('el mar de nubes es opaco y determinista', () => {
    const a = new Uint8ClampedArray(W * H * 4);
    const b = new Uint8ClampedArray(W * H * 4);
    bakeCloudSea(11, a);
    bakeCloudSea(11, b);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
    expect(a).toEqual(b);
  });

  it('la tesela encaja consigo misma: el borde derecho se parece al izquierdo', () => {
    const out = new Uint8ClampedArray(W * H * 4);
    bakeCloudSea(11, out);
    const lum = (x: number, y: number): number => out[(y * W + x) * 4 + 2];
    // Diferencia media entre la última columna y la primera (vecinas al repetirse), frente a dos columnas al azar
    let seam = 0, random = 0;
    for (let y = 0; y < H; y++) {
      seam += Math.abs(lum(W - 1, y) - lum(0, y));
      random += Math.abs(lum(40, y) - lum(170, y));
    }
    expect(seam).toBeLessThan(random);
  });

  it('el copo tiene forma (ni vacío ni lleno) y la sombra cubre el rombo a medias', () => {
    const puff = new Uint8ClampedArray(PUFF_W * PUFF_H * 4);
    bakeCloudPuff(7, PUFF_W, PUFF_H, puff);
    let solid = 0;
    for (let i = 3; i < puff.length; i += 4) if (puff[i] > 0) solid++;
    expect(solid).toBeGreaterThan(PUFF_W * PUFF_H * 0.2);
    expect(solid).toBeLessThan(PUFF_W * PUFF_H * 0.9);

    const w = 320, h = 160;
    const shadow = new Uint8ClampedArray(w * h * 4);
    bakeIslandShadow(w, h, 0x6f86ad, shadow);
    let dark = 0;
    for (let i = 3; i < shadow.length; i += 4) if (shadow[i] > 0) dark++;
    // Rombo = la mitad del rectángulo; tramado al 50 % → algo menos de un cuarto
    expect(dark / (w * h)).toBeGreaterThan(0.15);
    expect(dark / (w * h)).toBeLessThan(0.3);
  });
});
