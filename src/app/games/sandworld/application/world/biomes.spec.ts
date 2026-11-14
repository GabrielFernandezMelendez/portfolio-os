import { World } from './world';
import { BiomeSystem } from './biomes';
import { Biome } from '../../domain/models/biome.model';
import { Material } from '../../domain/models/material.model';
import { ChunkData, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { BIOME_CHANGE_DAYS } from '../../config/biomes.config';

/** Azar fijo para los tests */
const always = (v: number): RandomSource => ({ next: () => v });

/** Isla templada de tierra sana, sin agua */
function healthyWorld(): { world: World; chunk: ChunkData } {
  const world = new World(11, 1);
  const chunk = world.chunk(0, 0);
  for (let k = 0; k < chunk.water.length; k++) {
    chunk.water[k] = 0; chunk.sediment[k] = 1; chunk.material[k] = Material.SOIL; chunk.moisture[k] = 0.5; chunk.spring[k] = 0;
  }
  chunk.temperature.fill(0.5); chunk.humidity.fill(0.5); chunk.fertility.fill(0.6); chunk.biome.fill(Biome.FOREST);
  return { world, chunk };
}

/** Pone un material en todas las celdas del tile (i, j) */
function paintTile(chunk: ChunkData, i: number, j: number, material: number): void {
  for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) chunk.material[cellIndex(i * 4 + di, j * 4 + dj)] = material;
}

describe('Biomas', () => {
  it('el mundo nuevo empieza solo con biomas de clima (sin pantano, roquedal, quemada ni claro)', () => {
    const chunk = new World(11, 1).chunk(0, 0);
    const allowed: number[] = [Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WETLAND];
    expect([...chunk.biome].every(b => allowed.includes(b))).toBe(true);
  });

  it('un tile con barro y humedad pasa a pantano, pero solo tras días cumpliéndolo', () => {
    const { world, chunk } = healthyWorld();
    const biomes = new BiomeSystem(world, always(0.5));
    paintTile(chunk, 2, 2, Material.MUD);
    biomes.update(BIOME_CHANGE_DAYS / 2);
    expect(chunk.biome[tileIndex(2, 2)]).toBe(Biome.FOREST);
    const changes = biomes.update(BIOME_CHANGE_DAYS / 2 + 0.01);
    expect(chunk.biome[tileIndex(2, 2)]).toBe(Biome.SWAMP);
    expect(changes.some(c => c.to === Biome.SWAMP)).toBe(true);
  });

  it('si deja de cumplirlo antes de tiempo, la cuenta vuelve a empezar', () => {
    const { world, chunk } = healthyWorld();
    const biomes = new BiomeSystem(world, always(0.5));
    paintTile(chunk, 2, 2, Material.MUD);
    biomes.update(BIOME_CHANGE_DAYS * 0.9);
    paintTile(chunk, 2, 2, Material.SOIL);
    biomes.update(0.1);
    paintTile(chunk, 2, 2, Material.MUD);
    biomes.update(BIOME_CHANGE_DAYS * 0.5);
    expect(chunk.biome[tileIndex(2, 2)]).toBe(Biome.FOREST);
  });

  it('el suelo calcinado es Tierra Quemada al momento y su fertilidad cae a 0', () => {
    const { world, chunk } = healthyWorld();
    const biomes = new BiomeSystem(world, always(0.5));
    paintTile(chunk, 3, 3, Material.CHARRED);
    biomes.update(1 / 24);
    expect(chunk.biome[tileIndex(3, 3)]).toBe(Biome.BURNT);
    expect(chunk.fertility[tileIndex(3, 3)]).toBe(0);
  });

  it('Despertar + Afinidad en tierra sana: el claro nace solo si sale el sorteo, y el intento se gasta', () => {
    const lucky = healthyWorld();
    const t = tileIndex(4, 4);
    lucky.chunk.essence[t] = 0.3; lucky.chunk.affinity[t] = 0.3;
    new BiomeSystem(lucky.world, always(0.01)).update(1 / 24);
    expect(lucky.chunk.biome[t]).toBe(Biome.GLADE);

    const unlucky = healthyWorld();
    unlucky.chunk.essence[t] = 0.3; unlucky.chunk.affinity[t] = 0.3;
    const biomes = new BiomeSystem(unlucky.world, always(0.5));
    biomes.update(1 / 24);
    expect(unlucky.chunk.biome[t]).toBe(Biome.FOREST);
    expect(unlucky.chunk.essence[t]).toBeCloseTo(0.1, 5);       // el intento gastó esencia y afinidad
    expect(unlucky.chunk.gladeWait[t]).toBeGreaterThan(0);       // y hay que esperar para el siguiente
  });

  it('el claro se apaga si la tierra se quema', () => {
    const { world, chunk } = healthyWorld();
    const biomes = new BiomeSystem(world, always(0.5));
    expect(biomes.forceGlade(0, 0)).toBe(true);
    biomes.update(1 / 24);
    const t = [...chunk.glade].indexOf(1);
    expect(chunk.biome[t]).toBe(Biome.GLADE);
    paintTile(chunk, t % 8, Math.floor(t / 8), Material.CHARRED);
    biomes.update(1 / 24);
    expect(chunk.glade[t]).toBe(0);
    expect(chunk.biome[t]).toBe(Biome.BURNT);
  });

  it('en cada estación un claro crece como mucho un tile por chunk', () => {
    const { world, chunk } = healthyWorld();
    const biomes = new BiomeSystem(world, always(0.01));
    biomes.forceGlade(0, 0);
    biomes.newSeason();
    expect([...chunk.glade].filter(g => g === 1).length).toBe(2);
    const unlucky = healthyWorld();
    const b2 = new BiomeSystem(unlucky.world, always(0.5));
    b2.forceGlade(0, 0);
    b2.newSeason();
    expect([...unlucky.chunk.glade].filter(g => g === 1).length).toBe(1);
  });
});
