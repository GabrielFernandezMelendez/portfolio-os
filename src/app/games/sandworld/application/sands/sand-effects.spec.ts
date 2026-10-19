import { World } from '../world/world';
import { TerrainPhysics } from '../physics/terrain-physics';
import { PourQueue } from './pour-queue';
import { Stroke } from './stroke';
import { Sand, SandId } from '../../domain/models/sand.model';
import { Material } from '../../domain/models/material.model';
import { cellIndex, ChunkData, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { SeededRandom } from '../../infrastructure/seeded-random';

const C = WORLD.CELLS;

/** Meseta llana de tierra a altura 3, templada, sin agua ni manantiales */
function setup(): { physics: TerrainPhysics; queue: PourQueue; chunk: ChunkData } {
  const world = new World(11);
  const chunk = world.chunk(0, 0);
  for (let k = 0; k < C * C; k++) {
    chunk.rock[k] = 2; chunk.sediment[k] = 1; chunk.material[k] = Material.SOIL;
    chunk.water[k] = 0; chunk.spring[k] = 0; chunk.moisture[k] = 0;
  }
  chunk.temperature.fill(0.55);
  const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false });
  return { physics, queue: new PourQueue(physics, new SeededRandom(3)), chunk };
}

/** Vierte un trazo de `seconds` sobre el bloque (gx, gy) y lo deja asentarse entero */
function pour(physics: TerrainPhysics, queue: PourQueue, sand: SandId, gx: number, gy: number, seconds = 3): void {
  const s = new Stroke(sand);
  queue.preview(sand, s.pour(gx, gy, seconds));
  queue.commit(s);
  while (queue.active.length) {
    queue.minute();
    physics.minute();
  }
}

const k = cellIndex(16, 16);

describe('Efectos de las arenas', () => {
  it('Marea excava hasta dejar la roca desnuda', () => {
    const { physics, queue, chunk } = setup();
    pour(physics, queue, Sand.MAREA, 16, 16);
    expect(chunk.sediment[k]).toBeLessThan(0.1);
    expect(chunk.rock[k]).toBe(2);   // la roca no se toca
  });

  it('Duna entierra un manantial (deja de manar) y Marea lo vuelve a abrir', { timeout: 30000 }, () => {
    const { physics, queue, chunk } = setup();
    physics.setSpring(16, 16, 0.02);
    physics.minute();
    expect(chunk.water[k]).toBeGreaterThan(0);
    pour(physics, queue, Sand.DUNA, 16, 16);
    expect(physics.takeSpringChanges().map(c => c.state)).toContain('buried');
    // Sin manar, el agua de la celda solo puede irse
    const before = chunk.water[k];
    physics.minute(); physics.minute();
    expect(chunk.water[k]).toBeLessThanOrEqual(before + 1e-6);
    pour(physics, queue, Sand.MAREA, 16, 16);
    pour(physics, queue, Sand.MAREA, 16, 16);
    expect(physics.takeSpringChanges().map(c => c.state)).toContain('open');
  });

  it('Duna tapa el manantial en cuanto cae encima, sin esperar a que se asiente', () => {
    const { physics, queue, chunk } = setup();
    physics.setSpring(16, 16, 0.02);
    physics.minute();
    const s = new Stroke(Sand.DUNA);
    queue.preview(s.sand, s.pour(16, 16, 1));
    queue.commit(s);
    physics.minute();
    expect(physics.takeSpringChanges().map(c => c.state)).toContain('buried');
    // Un toque suelto no basta
    const other = setup();
    other.physics.setSpring(16, 16, 0.02);
    other.physics.minute();
    const tap = new Stroke(Sand.DUNA);
    other.queue.preview(tap.sand, tap.pour(16, 16, 0.15));
    other.queue.commit(tap);
    other.physics.minute();
    expect(other.physics.takeSpringChanges()).toEqual([]);
  });

  it('Escarcha congela el agua en hielo y tapa el manantial hasta que se funde', { timeout: 30000 }, () => {
    const { physics, queue, chunk } = setup();
    physics.setSpring(16, 16, 0.02);
    for (let i = 0; i < 10; i++) physics.minute();
    pour(physics, queue, Sand.ESCARCHA, 16, 16);
    expect(chunk.cover[k]).toBeGreaterThan(0.15);
    expect(physics.takeSpringChanges().map(c => c.state)).toContain('frozen');
    // Con 0,55 de temperatura se funde en unos días
    for (let i = 0; i < 6 * 1440 && chunk.cover[k] > 0; i++) physics.minute();
    expect(chunk.cover[k]).toBe(0);
    expect(physics.takeSpringChanges().map(c => c.state)).toContain('open');
  });

  it('Brasa seca el agua y el barro y chamusca el suelo, pero nunca lo calcina', () => {
    const { physics, queue, chunk } = setup();
    chunk.plants.fill(0);
    chunk.water[k] = 0.3; chunk.material[k] = Material.MUD; chunk.moisture[k] = 1;
    physics.addWater(16, 16, 0);
    for (let n = 0; n < 3; n++) pour(physics, queue, Sand.BRASA, 16, 16);
    expect(chunk.water[k]).toBeLessThan(0.05);
    expect(chunk.material[k]).not.toBe(Material.MUD);
    expect(chunk.material[k]).not.toBe(Material.CHARRED);
    expect(chunk.scorch[k]).toBeGreaterThan(0.3);
    expect(chunk.scorch[k]).toBeLessThan(0.95);      // no mata plantas: eso solo lo hace el fuego
  });

  it('Brasa sobre vegetación seca prende fuego', () => {
    const { physics, queue, chunk } = setup();
    const t = tileIndex(4, 4);
    chunk.plants.fill(0);
    chunk.plants[t * 32] = 1;                         // hierba
    chunk.humidity.fill(0.2);
    physics.fire.conditions.season = 1;              // verano
    pour(physics, queue, Sand.BRASA, 16, 16);
    expect(queue.events.some(e => e.outcome === 'ignited')).toBe(true);
    expect(chunk.fire[t] > 0 || chunk.burnedAt[t] >= 0).toBe(true);
  });

  it('Manantial crea una fuente donde más cayó; otro vertido cerca la refuerza', () => {
    const { physics, queue, chunk } = setup();
    pour(physics, queue, Sand.MANANTIAL, 16, 16);
    const springs = () => [...chunk.spring].map((v, i) => [v, i]).filter(([v]) => v > 0);
    expect(springs().length).toBe(1);
    const rate = springs()[0][0];
    pour(physics, queue, Sand.MANANTIAL, 17, 16);
    expect(springs().length).toBe(1);
    expect(springs()[0][0]).toBeGreaterThan(rate);
  });

  it('arenas de capa: el suelo cambia de color a mitad del asentamiento, no al empezar', () => {
    const { physics, queue, chunk } = setup();
    const s = new Stroke(Sand.HUMUS);
    queue.preview(s.sand, s.pour(16, 16, 3));
    const p = queue.commit(s)!;
    const half = Math.floor(p.duration / 2) - 5;
    for (let i = 0; i < half; i++) { queue.minute(); physics.minute(); }
    expect(chunk.material[k]).toBe(Material.SOIL);
    expect(chunk.sediment[k]).toBeGreaterThan(1.1);        // el humus ya se está sumando
    for (let i = 0; i < 20; i++) { queue.minute(); physics.minute(); }
    expect(chunk.material[k]).toBe(Material.HUMUS);
  });

  it('Humus sube la fertilidad y la humedad', () => {
    const { physics, queue, chunk } = setup();
    const t = tileIndex(4, 4);
    const fert = chunk.fertility[t];
    pour(physics, queue, Sand.HUMUS, 16, 16);
    expect(chunk.fertility[t]).toBeGreaterThan(fert);
    expect(chunk.moisture[k]).toBeGreaterThan(0.4);
    expect(chunk.material[k]).toBe(Material.HUMUS);
  });

  it('Despertar y Afinidad no cambian la altura y suben esencia y afinidad', () => {
    const { physics, queue, chunk } = setup();
    const h = groundAt(chunk, k);
    const t = tileIndex(4, 4);
    pour(physics, queue, Sand.DESPERTAR, 16, 16);
    pour(physics, queue, Sand.AFINIDAD, 16, 16);
    expect(groundAt(chunk, k)).toBeCloseTo(h, 6);
    expect(chunk.essence[t]).toBeGreaterThan(0);
    expect(chunk.affinity[t]).toBeGreaterThan(0);
  });
});
