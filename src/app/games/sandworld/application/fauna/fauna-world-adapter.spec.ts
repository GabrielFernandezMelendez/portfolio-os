import { World } from '../world/world';
import { VegetationSystem } from '../vegetation/vegetation';
import { FaunaWorldAdapter } from './fauna-world-adapter';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { Season } from '../../domain/models/time.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { SPECIES_DEFS } from '../../config/species.config';
import { layoutOf, plantDevFlags } from '../vegetation/plant-layout';

const deer = SPECIES_DEFS[0];
const id = (key: string) => PLANT_DEFS.find(p => p.key === key)!.id;
const NONE = new Set<number>();

function setup() {
  const world = new World(42, 1);
  const chunk = world.chunk(0, 0);
  const adapter = new FaunaWorldAdapter(world, new VegetationSystem(world, new SeededRandom(1)));
  return { world, chunk, adapter };
}

describe('Fauna: el mundo visto por los animales (adaptador)', () => {
  it('pastar baja la biomasa del tile y avisa para redibujar el chunk', () => {
    const { chunk, adapter } = setup();
    const t = tileIndex(3, 3);
    chunk.plants.fill(0, t * PLANT_SLOTS, (t + 1) * PLANT_SLOTS);
    chunk.plants[t * PLANT_SLOTS + id('grass')] = 0.8;
    const food = adapter.foodAt(13, 13, deer.diets, NONE, 0, Season.SPRING);
    expect(food).toBeGreaterThan(0.1);
    let eaten = 0;
    for (let n = 0; n < 2000; n++) eaten += adapter.eat(13, 13, deer.diets, NONE, 0.001, -1, 0, Season.SPRING)?.food ?? 0;
    expect(eaten).toBeGreaterThan(0.1);
    expect(chunk.plants[t * PLANT_SLOTS + id('grass')]).toBeLessThan(0.1);
    expect(adapter.takeChanges()).toEqual([{ cx: 0, cy: 0 }]);
    // Lo que se evita (conocimiento de la manada) no se come
    expect(adapter.foodAt(13, 13, deer.diets, new Set([id('grass')]), 0, Season.SPRING)).toBe(0);
  });

  it('come fruta madura de árboles y arbustos (y vuelve poco a poco)', () => {
    const { world, chunk, adapter } = setup();
    plantDevFlags.fruitAllYear = true;
    try {
      const plants = layoutOf(chunk, (cx, cy) => world.exploration.isRevealed(cx, cy), 0);
      const tree = plants.find(p => PLANT_DEFS[p.plant].food?.seasons && PLANT_DEFS[p.plant].food!.diets.includes('frugivore') && !PLANT_DEFS[p.plant].toxic);
      expect(tree).toBeDefined();
      const gx = tree!.ci, gy = tree!.cj;
      const t = tileIndex(Math.floor(gx / 4), Math.floor(gy / 4));
      for (const p of PLANT_DEFS) if (!p.food?.seasons) chunk.plants[t * PLANT_SLOTS + p.id] = 0;
      const meal = adapter.eat(gx, gy, deer.diets, NONE, 0.001, -1, 0, Season.SUMMER);
      expect(meal?.fruit).toBe(true);
      expect(Number.isFinite(plants.find(p => p.plant === meal!.plant && Math.floor(p.ci / 4) === Math.floor(gx / 4) && Math.floor(p.cj / 4) === Math.floor(gy / 4) && p.eatenAt === 0)?.eatenAt)).toBe(true);
    } finally {
      plantDevFlags.fruitAllYear = false;
    }
  });

  it('no se pisa el agua honda ni la Tierra Quemada; encuentra el agua para beber', () => {
    const { chunk, adapter } = setup();
    chunk.water[cellIndex(10, 10)] = 0.5;
    chunk.material[cellIndex(20, 20)] = Material.CHARRED;
    expect(adapter.walkable(10, 10)).toBe(false);
    expect(adapter.walkable(20, 20)).toBe(false);
    expect(adapter.walkable(-5, 3)).toBe(false);    // fuera de lo descubierto
    const w = adapter.nearestWater(12, 10, 5);
    expect(w).not.toBeNull();
    expect(w!.distance).toBeLessThanOrEqual(2);
  });

  it('el fuego en el tile o al lado es peligro, y dice de dónde viene', () => {
    const { chunk, adapter } = setup();
    chunk.fire[tileIndex(2, 2)] = 1;
    expect(adapter.danger(9, 9).level).toBe(1);
    const near = adapter.danger(13, 9);
    expect(near.level).toBe(0.5);
    expect(near.fromX).toBeLessThan(13);
    expect(adapter.danger(25, 25).level).toBe(0);
  });

  it('no pisan las dos últimas celdas junto al vacío (la pared de la isla)', () => {
    const { chunk, adapter } = setup();
    for (let k = 0; k < chunk.water.length; k++) { chunk.water[k] = 0; chunk.material[k] = Material.SOIL; }
    for (const x of [0, 1, 30, 31]) expect(adapter.walkable(x, 16)).toBe(false);
    for (const y of [0, 1, 30, 31]) expect(adapter.walkable(16, y)).toBe(false);
    expect(adapter.walkable(2, 16)).toBe(true);
    expect(adapter.walkable(16, 29)).toBe(true);
  });
});
