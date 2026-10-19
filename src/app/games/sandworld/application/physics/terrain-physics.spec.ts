import { World } from '../world/world';
import { TerrainPhysics } from './terrain-physics';
import { Material } from '../../domain/models/material.model';
import { MATERIALS } from '../../config/materials.config';
import { WORLD } from '../../domain/models/world.model';
import { groundAt } from '../../domain/models/chunk.model';

const C = WORLD.CELLS;

/** Suma de sedimento de todos los chunks descubiertos */
function totalSediment(world: World): number {
  let s = 0;
  for (const { cx, cy } of world.exploration.list()) {
    for (const v of world.chunk(cx, cy).sediment) s += v;
  }
  return s;
}

/** Ejecuta minutos hasta que todo se asiente (o hasta un tope) */
function settle(physics: TerrainPhysics, maxMinutes = 2000): number {
  let m = 0;
  while (physics.settling > 0 && m < maxMinutes) {
    physics.minute();
    m++;
  }
  return m;
}

describe('TerrainPhysics · desprendimientos', () => {
  it('un montón de arena se desmorona hasta respetar el talud de la arena', () => {
    const world = new World(11);
    world.chunk(0, 0).plants.fill(0);         // sin raíces que sujeten (eso tiene su propia prueba)
    const physics = new TerrainPhysics(world);
    physics.deposit(16, 16, Material.SAND, 4);
    expect(settle(physics)).toBeLessThan(2000);

    const g = (x: number, y: number): number => physics.grid.ground(physics.grid.cell(x, y)!);
    const repose = MATERIALS[Material.SAND].repose;
    // Alrededor del montón ninguna celda de arena supera el talud con sus vecinas
    for (let y = 10; y <= 22; y++) {
      for (let x = 10; x <= 22; x++) {
        const cell = physics.grid.cell(x, y)!;
        if (cell.chunk.material[cell.k] !== Material.SAND || cell.chunk.sediment[cell.k] <= 0.001) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          expect(g(x, y) - g(x + dx, y + dy)).toBeLessThanOrEqual(repose + 0.02);
        }
      }
    }
  });

  it('la masa se conserva: no se crea ni se pierde sedimento', () => {
    const world = new World(11);
    const physics = new TerrainPhysics(world);
    const before = totalSediment(world);
    const added = physics.deposit(10, 20, Material.SAND, 3) + physics.deposit(22, 8, Material.HUMUS, 2);
    settle(physics);
    expect(totalSediment(world)).toBeCloseTo(before + added, 3);
  });

  it('la roca no se desliza y el borde de lo descubierto hace de muro', () => {
    const world = new World(11);
    const physics = new TerrainPhysics(world);
    const chunk = world.chunk(0, 0);
    const rockBefore = Float32Array.from(chunk.rock);
    // Montón pegado al borde: nada puede salir del chunk (los vecinos siguen bajo las nubes)
    physics.deposit(0, 16, Material.SAND, 4);
    const before = totalSediment(world);
    settle(physics);
    expect(Array.from(chunk.rock)).toEqual(Array.from(rockBefore));
    expect(totalSediment(world)).toBeCloseTo(before, 3);
  });

  it('el terreno generado no se mueve hasta que algo lo despierta', () => {
    const world = new World(11);
    const physics = new TerrainPhysics(world);
    const chunk = world.chunk(0, 0);
    const before = Float32Array.from(chunk.sediment);
    for (let i = 0; i < 50; i++) physics.minute();
    expect(Array.from(chunk.sediment)).toEqual(Array.from(before));
  });

  it('los desprendimientos cruzan de un chunk descubierto a su vecino', () => {
    const world = new World(11);
    world.exploration.reveal(1, 0);
    const physics = new TerrainPhysics(world);
    const right = world.chunk(1, 0);
    const before = right.sediment.reduce((a, b) => a + b, 0);
    physics.deposit(C - 1, 16, Material.SAND, 4);              // última columna del chunk (0,0)
    settle(physics);
    expect(right.sediment.reduce((a, b) => a + b, 0)).toBeGreaterThan(before + 0.1);
  });

  it('el depósito respeta el techo de altura y avisa de los chunks cambiados', () => {
    const world = new World(11);
    const physics = new TerrainPhysics(world);
    const cell = physics.grid.cell(5, 5)!;
    const added = physics.deposit(5, 5, Material.SAND, 50);
    expect(groundAt(cell.chunk, cell.k)).toBeLessThanOrEqual(7.9 + 1e-6);
    expect(added).toBeLessThan(50);
    const changed = physics.minute();
    expect(changed).toContainEqual({ cx: 0, cy: 0 });
  });
});
