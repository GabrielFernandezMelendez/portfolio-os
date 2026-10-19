import { World } from '../world/world';
import { VegetationSystem, plantCapacity, rootsAt } from './vegetation';
import { invalidateLayout, layoutOf } from './plant-layout';
import { tileContext } from '../world/tile-context';
import { TerrainPhysics } from '../physics/terrain-physics';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { Biome } from '../../domain/models/biome.model';
import { Material } from '../../domain/models/material.model';
import { ChunkData, PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { Season } from '../../domain/models/time.model';
import { PLANT_DEFS } from '../../config/plants.config';

const byKey = (key: string) => PLANT_DEFS.find(p => p.key === key)!;
const at = (chunk: ChunkData, i: number, j: number, key: string): number => chunk.plants[tileIndex(i, j) * PLANT_SLOTS + byKey(key).id];

/** Isla templada de tierra fértil sin plantas, todo bosque */
function emptyForest(): { world: World; chunk: ChunkData } {
  const world = new World(11);
  const chunk = world.chunk(0, 0);
  for (let k = 0; k < chunk.water.length; k++) { chunk.water[k] = 0; chunk.material[k] = Material.SOIL; chunk.sediment[k] = 1; chunk.rock[k] = 2; chunk.moisture[k] = 0.5; chunk.cover[k] = 0; }
  chunk.temperature.fill(0.5); chunk.humidity.fill(0.5); chunk.fertility.fill(0.6); chunk.biome.fill(Biome.FOREST);
  chunk.plants.fill(0);
  for (let t = 0; t < 64; t++) chunk.vegGround[t] = 3;
  return { world, chunk };
}

describe('Vegetación', () => {
  it('cada planta solo puede crecer en sus biomas (cactus en el desierto, no en el bosque)', () => {
    const { chunk } = emptyForest();
    const ctx = tileContext(chunk, 2, 2);
    expect(plantCapacity(byKey('cactus'), ctx, Biome.FOREST)).toBe(0);
    expect(plantCapacity(byKey('oak'), ctx, Biome.FOREST)).toBeGreaterThan(0.5);
    expect(plantCapacity(byKey('glowFlower'), ctx, Biome.FOREST)).toBe(0);   // solo en el Claro
  });

  it('la hierba llena un tile en unos 5 días de primavera y no crece en invierno', () => {
    const { world, chunk } = emptyForest();
    const v = new VegetationSystem(world, new SeededRandom(1));
    const t = tileIndex(3, 3) * PLANT_SLOTS + byKey('grass').id;
    chunk.plants[t] = 0.05;
    for (let h = 0; h < 24 * 2; h++) v.update(1 / 24, Season.WINTER);
    expect(chunk.plants[t]).toBeCloseTo(0.05, 3);
    for (let h = 0; h < 24 * 6; h++) v.update(1 / 24, Season.SPRING);
    expect(chunk.plants[t]).toBeGreaterThan(0.8);
  });

  it('las plantas bien crecidas siembran tiles vecinos', () => {
    const { world, chunk } = emptyForest();
    const v = new VegetationSystem(world, new SeededRandom(3));
    chunk.plants[tileIndex(4, 4) * PLANT_SLOTS + byKey('grass').id] = 1;
    for (let d = 0; d < 20; d++) for (let h = 0; h < 24; h++) v.update(1 / 24, Season.SPRING);
    let tiles = 0;
    for (let t = 0; t < 64; t++) if (chunk.plants[t * PLANT_SLOTS + byKey('grass').id] > 0.05) tiles++;
    expect(tiles).toBeGreaterThan(2);
  });

  it('la arena que cae de golpe mata la hierba antes que un árbol', () => {
    const { world, chunk } = emptyForest();
    const v = new VegetationSystem(world, new SeededRandom(1));
    const physics = new TerrainPhysics(world);
    chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('grass').id] = 0.9;
    chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('oak').id] = 0.9;
    for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) chunk.sediment[cellIndex(8 + di, 8 + dj)] += 0.5;
    physics.minute();
    v.update(1 / 24, Season.SUMMER);
    expect(at(chunk, 2, 2, 'grass')).toBeLessThan(0.1);
    expect(at(chunk, 2, 2, 'oak')).toBeGreaterThan(0.4);
  });

  it('las raíces de los árboles dan talud extra al terreno', () => {
    const { chunk } = emptyForest();
    const k = cellIndex(9, 9);
    expect(rootsAt(chunk, k)).toBe(0);
    chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('willow').id] = 1;
    expect(rootsAt(chunk, k)).toBeCloseTo(1, 5);
  });

  it('el reparto de sprites es estable y respeta el sitio de los árboles', () => {
    const { chunk } = emptyForest();
    chunk.plants[tileIndex(3, 3) * PLANT_SLOTS + byKey('oak').id] = 1;
    chunk.plants[tileIndex(3, 3) * PLANT_SLOTS + byKey('grass').id] = 1;
    const a = layoutOf(chunk).map(p => `${p.plant}:${p.ci},${p.cj}`);
    invalidateLayout(chunk);
    const b = layoutOf(chunk).map(p => `${p.plant}:${p.ci},${p.cj}`);
    expect(b).toEqual(a);
    const oak = layoutOf(chunk).find(p => p.plant === byKey('oak').id)!;
    for (const p of layoutOf(chunk)) if (p !== oak) expect(Math.max(Math.abs(p.ci - oak.ci), Math.abs(p.cj - oak.cj))).toBeGreaterThan(2);
  });
});
