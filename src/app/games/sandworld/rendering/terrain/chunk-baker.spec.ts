import { BAKE_HEIGHT, BAKE_WIDTH, ChunkBaker } from './chunk-baker';
import { generateChunk } from '../../application/world/chunk-generator';
import { computeClimate } from '../../application/world/climate';

describe('ChunkBaker', () => {
  const SEED = 11;

  function bakeOnce(seed = SEED): Uint8ClampedArray {
    const chunk = generateChunk(seed, 0, 0);
    computeClimate(chunk, seed);
    const out = new Uint8ClampedArray(BAKE_WIDTH * BAKE_HEIGHT * 4);
    new ChunkBaker(seed).bake(chunk, out);
    return out;
  }

  /** Huella FNV-1a del buffer: comparar 290k bytes con toEqual es lento */
  function fingerprint(buf: Uint8ClampedArray): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < buf.length; i++) h = Math.imul(h ^ buf[i], 0x01000193);
    return h >>> 0;
  }

  function opaquePixels(buf: Uint8ClampedArray): number {
    let n = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
    return n;
  }

  it('pinta la isla y deja transparente el resto', () => {
    const out = bakeOnce();
    const opaque = opaquePixels(out);
    const total = BAKE_WIDTH * BAKE_HEIGHT;
    // El rombo ocupa aprox. la mitad del rectángulo, más paredes y relieve
    expect(opaque).toBeGreaterThan(total * 0.3);
    expect(opaque).toBeLessThan(total * 0.95);
    // Las esquinas del rectángulo quedan fuera del rombo
    expect(out[3]).toBe(0);
    expect(out[(BAKE_WIDTH - 1) * 4 + 3]).toBe(0);
  });

  it('es determinista', () => {
    expect(fingerprint(bakeOnce())).toBe(fingerprint(bakeOnce()));
  });

  it('re-hornear con la misma instancia da el mismo resultado', () => {
    const chunk = generateChunk(SEED, 0, 0);
    computeClimate(chunk, SEED);
    const baker = new ChunkBaker(SEED);
    const a = new Uint8ClampedArray(BAKE_WIDTH * BAKE_HEIGHT * 4);
    const b = new Uint8ClampedArray(BAKE_WIDTH * BAKE_HEIGHT * 4);
    baker.bake(chunk, a);
    baker.bake(chunk, b);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('el picking devuelve la celda que se ve en cada píxel', () => {
    const chunk = generateChunk(SEED, 0, 0);
    computeClimate(chunk, SEED);
    const baker = new ChunkBaker(SEED);
    const out = new Uint8ClampedArray(BAKE_WIDTH * BAKE_HEIGHT * 4);
    baker.bake(chunk, out);

    // Píxel transparente → sin celda; píxel opaco → siempre una celda válida
    let opaque = 0, picked = 0;
    for (let i = 0; i < BAKE_WIDTH * BAKE_HEIGHT; i++) {
      const cell = baker.pickCell(i % BAKE_WIDTH, Math.floor(i / BAKE_WIDTH));
      if (out[i * 4 + 3] === 0) expect(cell).toBe(-1);
      else {
        opaque++;
        if (cell >= 0 && cell < 32 * 32) picked++;
      }
    }
    expect(picked).toBe(opaque);
    expect(baker.pickCell(-1, 5)).toBe(-1);
  });
});
