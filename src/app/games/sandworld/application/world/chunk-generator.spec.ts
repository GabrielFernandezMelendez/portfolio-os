import { generateChunk, heightAt } from './chunk-generator';
import { computeClimate } from './climate';
import { groundAt } from '../../domain/models/chunk.model';
import { Biome } from '../../domain/models/biome.model';
import { WORLD } from '../../domain/models/world.model';
import { WATER_TABLE } from '../../config/world.config';

describe('generateChunk', () => {
  const SEED = 11;

  it('es determinista: misma semilla y coordenadas → mismo chunk', () => {
    const a = generateChunk(SEED, 0, 0);
    const b = generateChunk(SEED, 0, 0);
    expect(Array.from(a.rock)).toEqual(Array.from(b.rock));
    expect(Array.from(a.sediment)).toEqual(Array.from(b.sediment));
    expect(Array.from(a.water)).toEqual(Array.from(b.water));
  });

  it('semillas distintas generan terrenos distintos', () => {
    const a = generateChunk(SEED, 0, 0);
    const b = generateChunk(SEED + 1, 0, 0);
    expect(Array.from(a.rock)).not.toEqual(Array.from(b.rock));
  });

  it('mantiene la altura dentro de los límites de nivel', () => {
    const c = generateChunk(SEED, 0, 0);
    for (let k = 0; k < c.rock.length; k++) {
      const g = groundAt(c, k);
      expect(g).toBeGreaterThanOrEqual(0.2);
      expect(g).toBeLessThanOrEqual(WORLD.MAX_LEVEL + 0.9);
      expect(c.sediment[k]).toBeGreaterThanOrEqual(0);
    }
  });

  it('solo hay agua por debajo del nivel freático y llega justo hasta él', () => {
    const c = generateChunk(SEED, 0, 0);
    for (let k = 0; k < c.water.length; k++) {
      const g = groundAt(c, k);
      if (g >= WATER_TABLE) expect(c.water[k]).toBe(0);
      else expect(g + c.water[k]).toBeCloseTo(WATER_TABLE, 4);
    }
  });

  it('el relieve continúa entre chunks vecinos (coordenadas globales)', () => {
    // El borde derecho del chunk (0,0) y el izquierdo del (1,0) muestrean puntos contiguos de la misma función
    const edge = heightAt(SEED, WORLD.TILES - 0.5, 3);
    const next = heightAt(SEED, WORLD.TILES - 0.5 + 1e-3, 3);
    expect(Math.abs(edge - next)).toBeLessThan(0.05);
  });

  it('el clima asigna biomas válidos y valores 0..1', () => {
    const c = generateChunk(SEED, 0, 0);
    computeClimate(c, SEED);
    const valid = Object.values(Biome) as number[];
    for (let t = 0; t < c.biome.length; t++) {
      expect(valid).toContain(c.biome[t]);
      expect(c.temperature[t]).toBeGreaterThanOrEqual(0);
      expect(c.temperature[t]).toBeLessThanOrEqual(1);
      expect(c.humidity[t]).toBeGreaterThanOrEqual(0);
      expect(c.humidity[t]).toBeLessThanOrEqual(1);
    }
  });

  it('el mundo inicial tiene variedad de biomas', () => {
    const c = generateChunk(SEED, 0, 0);
    computeClimate(c, SEED);
    expect(new Set(c.biome).size).toBeGreaterThanOrEqual(3);
  });
});
