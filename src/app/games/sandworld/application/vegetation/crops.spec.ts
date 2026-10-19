import { World } from '../world/world';
import { VegetationSystem } from './vegetation';
import { Stage, invalidateLayout, layoutOf, stageOf } from './plant-layout';
import { Biome } from '../../domain/models/biome.model';
import { Material } from '../../domain/models/material.model';
import { ChunkData, PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { Season } from '../../domain/models/time.model';
import { CROP_CARE_DAYS, PLANT_DEFS, PLANT_SPACE } from '../../config/plants.config';
import { SeededRandom } from '../../infrastructure/seeded-random';

const id = (key: string) => PLANT_DEFS.find(p => p.key === key)!.id;
const always = (v: number): RandomSource => ({ next: () => v });
const open = () => true;

function forest(): { world: World; chunk: ChunkData } {
  const world = new World(11);
  const chunk = world.chunk(0, 0);
  for (let k = 0; k < chunk.water.length; k++) { chunk.water[k] = 0; chunk.material[k] = Material.SOIL; chunk.sediment[k] = 1; chunk.rock[k] = 2; chunk.moisture[k] = 0.5; chunk.cover[k] = 0; }
  chunk.temperature.fill(0.5); chunk.humidity.fill(0.5); chunk.fertility.fill(0.6); chunk.biome.fill(Biome.FOREST);
  chunk.plants.fill(0); chunk.crop.fill(0);
  for (let t = 0; t < 64; t++) chunk.vegGround[t] = 3;
  return { world, chunk };
}

describe('Semillas y cultivos', () => {
  it('una semilla solo germina donde la planta podría crecer sola y con sitio libre', () => {
    const { world, chunk } = forest();
    const v = new VegetationSystem(world, always(0));          // el sorteo de semilla siempre sale
    expect(v.germinate(id('cactus'), 8, 8)).toBe(false);        // un cactus no crece en el bosque
    expect(v.germinate(id('redBerries'), 8, 8)).toBe(true);
    // Tile lleno: no queda sitio
    for (const p of PLANT_DEFS) if (p.kind === 'tree') chunk.plants[tileIndex(4, 4) * PLANT_SLOTS + p.id] = 1;
    expect(v.germinate(id('redBerries'), 17, 17)).toBe(false);
  });

  it('comer y sembrar sin parar no sube la vegetación por encima de lo natural', () => {
    const { world, chunk } = forest();
    const v = new VegetationSystem(world, new SeededRandom(9));
    const rnd = new SeededRandom(4);
    for (let d = 0; d < 60; d++) {
      for (let h = 0; h < 24; h++) v.update(1 / 24, Season.SPRING);
      // 50 comidas al día: quitan biomasa de bayas y dejan semillas por la isla
      for (let n = 0; n < 50; n++) {
        const t = Math.floor(rnd.next() * 64), k = t * PLANT_SLOTS + id('redBerries');
        chunk.plants[k] = Math.max(0, chunk.plants[k] - 0.05);
        v.germinate(id('redBerries'), Math.floor(rnd.next() * 32), Math.floor(rnd.next() * 32));
      }
    }
    for (let t = 0; t < 64; t++) {
      let used = 0;
      for (const p of PLANT_DEFS) used += chunk.plants[t * PLANT_SLOTS + p.id] * PLANT_SPACE[p.kind];
      expect(used).toBeLessThanOrEqual(1.0001);
    }
  });

  it('como mucho un cultivo por casilla del cursor (2 × 2 celdas); los árboles, con una casilla libre entre ellos', () => {
    const { world } = forest();
    const v = new VegetationSystem(world, always(0.5));
    expect(v.sow(id('redBerries'), 10, 10, open)).toBe(true);
    expect(v.sow(id('redBerries'), 11, 11, open)).toBe(false);   // misma casilla (10..11)
    expect(v.sow(id('redBerries'), 12, 10, open)).toBe(true);    // casilla de al lado, pegada
    expect(v.sow(id('appleTree'), 14, 10, open)).toBe(true);     // un árbol junto a un arbusto, sí
    expect(v.sow(id('appleTree'), 16, 10, open)).toBe(false);    // pegado a otro árbol, no
    expect(v.sow(id('appleTree'), 18, 10, open)).toBe(true);     // con una casilla libre en medio, sí
    expect(v.sow(id('cactus'), 20, 20, open)).toBe(false);       // no crece en este bioma
  });

  it('los cultivos se dibujan todos, juntos, aunque lo silvestre necesite separación', () => {
    const { world, chunk } = forest();
    const v = new VegetationSystem(world, always(0.5));
    for (let x = 8; x < 18; x += 2) v.sow(id('redBerries'), x, 8, open);
    invalidateLayout(chunk);
    const crops = layoutOf(chunk, open).filter(p => p.crop);
    expect(crops.length).toBe(5);
    expect(crops.every(p => stageOf(p, 0) <= Stage.SPROUT)).toBe(true);   // recién sembrados: semilla o brote
  });

  it('crecen, se cosechan (las bayas rebrotan) y sin cuidado se asilvestran', () => {
    const { world, chunk } = forest();
    const v = new VegetationSystem(world, always(0.5));
    v.sow(id('redBerries'), 9, 9, open);           // casilla 8..9 × 8..9: se guarda en su primera celda
    v.sow(id('grass'), 13, 13, open);
    const k = cellIndex(8, 8);
    for (let d = 0; d < 15; d++) for (let h = 0; h < 24; h++) v.update(1 / 24, Season.SUMMER);
    expect(chunk.cropGrowth[k]).toBeGreaterThan(0.6);
    expect(v.harvest(9, 9, Season.SUMMER)).toBeGreaterThan(0.2);
    expect(chunk.crop[k]).toBe(id('redBerries') + 1);               // rebrota
    expect(v.harvest(13, 13, Season.SUMMER)).toBeGreaterThan(0);
    expect(chunk.crop[cellIndex(12, 12)]).toBe(0);                  // la hierba se acaba
    // Nadie vuelve a cuidarla: se asilvestra
    for (let d = 0; d < CROP_CARE_DAYS + 1; d++) v.update(1, Season.SUMMER);
    expect(chunk.crop[k]).toBe(0);
    expect(chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + id('redBerries')]).toBeGreaterThan(0);
  });
});
