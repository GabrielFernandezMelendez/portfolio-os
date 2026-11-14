import { World } from '../world/world';
import { TerrainPhysics } from '../physics/terrain-physics';
import { PourQueue } from './pour-queue';
import { Stroke } from './stroke';
import { Sand } from '../../domain/models/sand.model';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { POUR_DAYS_MAX, POUR_DAYS_MIN, POUR_DWELL_SECONDS, POUR_MAX_DUNE, STROKE_TOTAL_CAP } from '../../config/pour.config';
import { BRUSH_CELLS } from '../../config/brush.config';

const setup = () => {
  const world = new World(11, 1);
  world.chunk(0, 0);
  const physics = new TerrainPhysics(world);
  const queue = new PourQueue(physics, new SeededRandom(5));
  return { world, physics, queue };
};
const totalGround = (physics: TerrainPhysics): number => {
  let s = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) s += physics.grid.ground(physics.grid.cell(x, y)!);
  return s;
};

describe('Stroke (pincel)', () => {
  it('rendimiento decreciente: tras τ segundos ha caído ~63 % del máximo por celda', () => {
    const s = new Stroke(Sand.DUNA);
    s.pour(10, 10, POUR_DWELL_SECONDS);
    const perCell = s.cells.get([...s.cells.keys()][0])!;
    expect(perCell).toBeCloseTo(POUR_MAX_DUNE * (1 - Math.exp(-1)), 4);
    // Quedarse mucho más tiempo nunca pasa del máximo
    s.pour(10, 10, 60);
    expect(s.cells.get([...s.cells.keys()][0])!).toBeLessThanOrEqual(POUR_MAX_DUNE + 1e-9);
  });

  it('el trazo tiene tope total y la botella se vacía', () => {
    const s = new Stroke(Sand.DUNA);
    for (let i = 0; i < 40; i++) s.pour((i % 8) * BRUSH_CELLS, Math.floor(i / 8) * BRUSH_CELLS, 10);
    expect(s.poured).toBeCloseTo(STROKE_TOTAL_CAP, 6);
    expect(s.remaining).toBe(0);
    expect(s.pour(30, 30, 5)).toEqual([]);
  });
});

describe('PourQueue (asentamiento)', () => {
  it('lo depositado al terminar es lo vertido, y tarda entre 1 y 2 días', () => {
    const { physics, queue } = setup();
    const before = totalGround(physics);
    const s = new Stroke(Sand.DUNA);
    queue.preview(s.sand, s.pour(14, 14, 2));
    const pour = queue.commit(s)!;
    expect(pour.duration).toBeGreaterThanOrEqual(POUR_DAYS_MIN * 1440);
    expect(pour.duration).toBeLessThanOrEqual(POUR_DAYS_MAX * 1440);
    let minutes = 0;
    while (queue.active.length) { queue.minute(); minutes++; }
    expect(minutes).toBe(pour.duration);
    // Los desprendimientos no crean ni destruyen terreno; la física no ha corrido, así que se compara directo
    expect(totalGround(physics) - before).toBeCloseTo(s.poured, 2);   // Float32: pequeño error de redondeo acumulado
    // La capa sin asentar desaparece
    const c = physics.grid.cell(14, 14)!;
    expect(c.chunk.pending[c.k]).toBe(0);
    expect(c.chunk.pendingSand[c.k]).toBe(0);
  });

  it('verter otra vez la misma arena sobre lo pendiente se suma y alarga el vertido', () => {
    const { queue } = setup();
    const a = new Stroke(Sand.DUNA);
    queue.preview(a.sand, a.pour(14, 14, 1));
    const p = queue.commit(a)!;
    for (let i = 0; i < 100; i++) queue.minute();
    const durationBefore = p.duration;
    const b = new Stroke(Sand.DUNA);
    queue.preview(b.sand, b.pour(14, 14, 1));
    expect(queue.commit(b)).toBe(p);
    expect(queue.active.length).toBe(1);
    expect(p.duration).toBeGreaterThan(durationBefore);
    // Otra arena en el mismo sitio es un vertido aparte
    const c = new Stroke(Sand.HUMUS);
    c.pour(14, 14, 1);
    expect(queue.commit(c)).not.toBe(p);
    expect(queue.active.length).toBe(2);
  });

  it('en pausa (sin minutos de juego) no se asienta nada', () => {
    const { physics, queue } = setup();
    const before = totalGround(physics);
    const s = new Stroke(Sand.DUNA);
    queue.preview(s.sand, s.pour(14, 14, 2));
    queue.commit(s);
    expect(totalGround(physics)).toBeCloseTo(before, 6);
    const c = physics.grid.cell(14, 14)!;
    expect(c.chunk.pending[c.k]).toBeGreaterThan(0);
  });
});
