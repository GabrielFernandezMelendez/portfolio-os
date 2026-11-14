import { World } from '../world/world';
import { TerrainPhysics } from '../physics/terrain-physics';
import { SAND_EFFECTS } from '../sands/sand-effects';
import { Sand } from '../../domain/models/sand.model';
import { Material } from '../../domain/models/material.model';
import { ChunkData, PLANT_SLOTS, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { isBurnt } from './fire';

const C = WORLD.CELLS;
const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
const DAY = 1440;
const id = (key: string) => PLANT_DEFS.find(p => p.key === key)!.id;

/** Bosque llano y seco de verano: hierba y robles en todos los tiles */
function forest(): { world: World; physics: TerrainPhysics; chunk: ChunkData } {
  const world = new World(11, 1);
  const chunk = world.chunk(0, 0);
  for (let k = 0; k < C * C; k++) {
    chunk.rock[k] = 2; chunk.sediment[k] = 1; chunk.material[k] = Material.SOIL;
    chunk.water[k] = 0; chunk.spring[k] = 0; chunk.moisture[k] = 0.1; chunk.cover[k] = 0;
  }
  chunk.humidity.fill(0.3); chunk.temperature.fill(0.6);
  chunk.plants.fill(0);
  for (let t = 0; t < N * N; t++) { chunk.plants[t * PLANT_SLOTS + id('grass')] = 1; chunk.plants[t * PLANT_SLOTS + id('oak')] = 0.6; }
  const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
  physics.fire.conditions.season = 1;
  return { world, physics, chunk };
}

const run = (physics: TerrainPhysics, days: number) => { for (let m = 0; m < days * DAY; m++) physics.minute(); };
const burnedTiles = (c: ChunkData) => [...c.burnedAt].filter(v => v >= 0).length + [...c.life].filter(v => v > 0).length;
const cell = (i: number, j: number) => [i * G + 1, j * G + 1] as const;

describe('Fuego', () => {
  it('lo seco y con combustible prende; lo mojado, la roca desnuda o la lluvia no', () => {
    const { physics, chunk } = forest();
    const f = physics.fire;
    expect(f.fuel(chunk, 2, 2) * f.dryness(chunk, 2, 2)).toBeGreaterThan(0.12);
    // Mojado
    for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) chunk.moisture[cellIndex(8 + di, 8 + dj)] = 1;
    chunk.humidity[tileIndex(2, 2)] = 1;
    expect(f.igniteAtCell(...cell(2, 2), 'lightning')).toBe(false);
    // Sin combustible (roca desnuda, como una zanja de Marea)
    const t = tileIndex(5, 5);
    for (const p of PLANT_DEFS) chunk.plants[t * PLANT_SLOTS + p.id] = 0;
    for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) chunk.sediment[cellIndex(20 + di, 20 + dj)] = 0;
    expect(f.igniteAtCell(...cell(5, 5), 'lightning')).toBe(false);
    // Lloviendo
    f.conditions.rain = 1;
    expect(f.igniteAtCell(...cell(6, 1), 'lightning')).toBe(false);
    f.conditions.rain = 0;
    expect(f.igniteAtCell(...cell(6, 1), 'lightning')).toBe(true);
  });

  it('el fuego sale del suelo, avanza de tile en tile, quema las plantas y deja ceniza fértil', () => {
    const { physics, chunk } = forest();
    const fert = chunk.fertility[tileIndex(4, 4)];
    physics.fire.igniteAtCell(...cell(4, 4), 'dev', true);
    run(physics, 0.1);
    expect(chunk.fire[tileIndex(4, 4)]).toBeGreaterThan(0);
    run(physics, 3);
    expect(burnedTiles(chunk)).toBeGreaterThan(9);
    expect(chunk.plants[tileIndex(4, 4) * PLANT_SLOTS + id('oak')]).toBe(0);
    expect(chunk.fertility[tileIndex(4, 4)]).toBeGreaterThan(fert);
  });

  it('una zanja sin combustible (Marea) para el fuego: no la cruza', () => {
    const { physics, chunk } = forest();
    // Zanja: la columna de tiles i = 4, roca desnuda y sin plantas
    for (let j = 0; j < N; j++) {
      const t = tileIndex(4, j);
      for (const p of PLANT_DEFS) chunk.plants[t * PLANT_SLOTS + p.id] = 0;
      for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) chunk.sediment[cellIndex(16 + di, j * G + dj)] = 0;
    }
    physics.fire.igniteAtCell(...cell(1, 4), 'dev', true);
    run(physics, 4);
    for (let j = 0; j < N; j++) for (let i = 5; i < N; i++) {
      expect(chunk.fire[tileIndex(i, j)]).toBe(0);
      expect(chunk.burnedAt[tileIndex(i, j)]).toBe(-1);
    }
    expect(burnedTiles(chunk)).toBeGreaterThan(4);
  });

  it('la lluvia apaga el fuego y la Escarcha lo apaga de golpe', () => {
    const { physics, chunk } = forest();
    physics.fire.igniteAtCell(...cell(1, 1), 'dev', true);
    physics.fire.igniteAtCell(...cell(6, 6), 'dev', true);
    run(physics, 0.05);
    SAND_EFFECTS[Sand.ESCARCHA].apply(physics, ...cell(6, 6), 1, 0.5);
    expect(chunk.fire[tileIndex(6, 6)]).toBe(0);
    physics.fire.conditions.rain = 1;
    run(physics, 0.5);
    expect([...chunk.fire].every(v => v === 0)).toBe(true);
    expect(physics.fire.news.some(n => n.type === 'out')).toBe(true);
  });

  it('nueve tiles quemados juntos hacen Tierra Quemada; un incendio pequeño solo deja ceniza', () => {
    // Pequeño: una isla de bosque de 2 × 2 tiles rodeada de roca
    const small = forest();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (i >= 2 && i < 4 && j >= 2 && j < 4) continue;
      const t = tileIndex(i, j);
      for (const p of PLANT_DEFS) small.chunk.plants[t * PLANT_SLOTS + p.id] = 0;
      for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) small.chunk.sediment[cellIndex(i * G + di, j * G + dj)] = 0;
    }
    small.physics.fire.igniteAtCell(...cell(2, 2), 'dev', true);
    run(small.physics, 3);
    expect([...small.chunk.life].every(v => v === 0)).toBe(true);
    expect([...small.chunk.material].some(m => m === Material.CHARRED)).toBe(false);
    expect(small.chunk.scorch[cellIndex(9, 9)]).toBeGreaterThan(0.5);
    // Grande: todo el bosque
    const big = forest();
    big.physics.fire.igniteAtCell(...cell(4, 4), 'dev', true);
    run(big.physics, 3);
    const burnt = [...big.chunk.life].filter(v => v > 0).length;
    expect(burnt).toBeGreaterThanOrEqual(9);
    expect(big.chunk.material[cellIndex(17, 17)]).toBe(Material.CHARRED);
    expect(big.physics.fire.news.some(n => n.type === 'burntLand')).toBe(true);
  });

  it('la Tierra Quemada evapora el agua y no deja surgir manantiales', () => {
    const { physics, chunk } = forest();
    physics.fire.makeBurntLand(2, 2);
    for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) physics.addWater(12 + di, 12 + dj, 0.5);
    run(physics, 0.05);
    expect(chunk.water[cellIndex(13, 13)]).toBe(0);
    const settled = SAND_EFFECTS[Sand.MANANTIAL].settled!(physics, [[13, 13, 1]]);
    expect(settled).toBe('springBurnt');
    expect(chunk.spring[cellIndex(13, 13)]).toBe(0);
  });

  it('crece despacio por sus bordes en verano; casi nada en invierno; un borde helado no crece', () => {
    const summer = forest();
    summer.physics.fire.makeBurntLand(2, 2);
    run(summer.physics, 20);
    const grown = [...summer.chunk.life].filter(v => v > 0).length;
    expect(grown).toBeGreaterThan(9);
    expect(grown).toBeLessThan(40);
    const winter = forest();
    winter.physics.fire.conditions.season = 3;
    winter.physics.fire.makeBurntLand(2, 2);
    run(winter.physics, 20);
    expect([...winter.chunk.life].filter(v => v > 0).length).toBeLessThanOrEqual(10);
  });

  it('el muro de Escarcha aguanta la Tierra Quemada en verano mientras dura, y luego se funde', () => {
    const { physics, chunk } = forest();
    physics.fire.makeBurntLand(2, 2);
    // Muro: hiela toda la corona de tiles alrededor del 3 × 3 (cargado al máximo)
    for (let j = 1; j <= 5; j++) for (let i = 1; i <= 5; i++) {
      if (i > 1 && i < 5 && j > 1 && j < 5) continue;
      for (let n = 0; n < 6; n++) physics.fire.douseAtCell(...cell(i, j), 1);
    }
    expect(chunk.frozen[tileIndex(1, 1)]).toBeGreaterThan(0);
    expect(physics.fire.igniteAtCell(...cell(1, 1), 'lightning')).toBe(false);
    run(physics, 7);
    expect([...chunk.life].filter(v => v > 0).length).toBe(9);
    run(physics, 3);
    expect(chunk.frozen[tileIndex(1, 1)]).toBe(0);
  });

  it('sin vida remite de fuera hacia dentro: el centro es el último en volver', () => {
    const { physics, chunk } = forest();
    physics.fire.conditions.season = 3;          // en invierno, para que no crezca mientras tanto
    physics.fire.makeBurntLand(2, 2);
    expect(isBurnt(chunk, 3, 3)).toBe(true);
    physics.fire.drainLife();
    let edgeBack = -1, centreBack = -1;
    for (let d = 1; d <= 30; d++) {
      run(physics, 1);
      if (edgeBack < 0 && !isBurnt(chunk, 2, 2)) edgeBack = d;
      if (centreBack < 0 && !isBurnt(chunk, 3, 3)) centreBack = d;
    }
    expect(edgeBack).toBeGreaterThan(0);
    expect(centreBack).toBeGreaterThan(edgeBack);
    expect(centreBack).toBeLessThanOrEqual(20);
    expect(chunk.material[cellIndex(13, 13)]).toBe(Material.SOIL);
    expect(chunk.plants[tileIndex(3, 3) * PLANT_SLOTS + id('grass')]).toBeGreaterThan(0);
  });

  it('un rayo cae y lo cuenta; en tormenta seca prende, con lluvia casi nunca', () => {
    const dry = forest();
    for (let i = 0; i < 200; i++) dry.physics.strike(1);
    expect(dry.physics.fire.news.filter(n => n.type === 'strike').length).toBe(200);
    expect(dry.physics.fire.news.some(n => n.type === 'strike' && n.ignited)).toBe(true);
    const wet = forest();
    wet.physics.fire.conditions.rain = 1;
    for (let i = 0; i < 200; i++) wet.physics.strike(1);
    expect(wet.physics.fire.news.some(n => n.type === 'strike' && n.ignited)).toBe(false);
  });
});
