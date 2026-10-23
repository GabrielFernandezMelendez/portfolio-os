import { World } from '../world/world';
import { TerrainPhysics } from './terrain-physics';
import { ChunkData, cellIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { SAND_EFFECTS } from '../sands/sand-effects';
import { Sand } from '../../domain/models/sand.model';

const C = WORLD.CELLS;
const DAY = 1440;

/**
 * Isla de prueba: meseta plana a altura 3 (por encima del nivel freático), sin agua ni manantiales.
 * `shape` puede modificar alturas: recibe (ci, cj) y devuelve la altura de esa celda.
 */
function flatIsland(shape?: (ci: number, cj: number) => number): { world: World; chunk: ChunkData } {
  const world = new World(11, 1);
  const chunk = world.chunk(0, 0);
  for (let cj = 0; cj < C; cj++) {
    for (let ci = 0; ci < C; ci++) {
      const k = cellIndex(ci, cj);
      chunk.rock[k] = shape ? shape(ci, cj) : 3;
      chunk.sediment[k] = 0;
      chunk.water[k] = 0;
      chunk.spring[k] = 0;
      chunk.moisture[k] = 0;
      chunk.material[k] = Material.SOIL;
    }
  }
  return { world, chunk };
}

const sum = (a: Float32Array): number => a.reduce((s, v) => s + v, 0);

describe('Agua', () => {
  it('se conserva: lo que hay + lo que cayó por los bordes = lo que había + lo que dieron los manantiales', () => {
    const { world, chunk } = flatIsland((ci, cj) => 3 + (ci + cj) * 0.05);   // ladera suave
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
    physics.addWater(20, 20, 2);
    physics.setSpring(25, 25, 0.05);
    const start = sum(chunk.water);
    let drained = 0;
    const minutes = 300;
    for (let i = 0; i < minutes; i++) {
      physics.minute();
      drained += sum(chunk.drain);
    }
    expect(sum(chunk.water) + drained).toBeCloseTo(start + 0.05 * minutes, 2);
  });

  it('baja por la pendiente y nunca sube sola', () => {
    const { world, chunk } = flatIsland((ci) => 2 + ci * 0.1);              // sube hacia la derecha
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
    // Menos agua que el escalón entre celdas (0,1): su superficie nunca supera a la vecina de arriba
    physics.addWater(20, 16, 0.05);
    for (let i = 0; i < 6; i++) physics.minute();
    let left = 0, right = 0;
    for (let cj = 0; cj < C; cj++) {
      for (let ci = 0; ci < C; ci++) {
        if (ci < 20) left += chunk.water[cellIndex(ci, cj)];
        if (ci > 20) right += chunk.water[cellIndex(ci, cj)];
      }
    }
    expect(left).toBeGreaterThan(0.02);
    expect(right).toBeLessThan(0.001);
  });

  it('un hoyo se llena y forma un lago que no se escapa mientras no rebose', () => {
    // Meseta a 3 con un hoyo de 5×5 a 2 en el centro
    const inHole = (ci: number, cj: number): boolean => ci >= 14 && ci <= 18 && cj >= 14 && cj <= 18;
    const { world, chunk } = flatIsland((ci, cj) => (inHole(ci, cj) ? 2 : 3));
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
    for (let cj = 14; cj <= 18; cj++) for (let ci = 14; ci <= 18; ci++) physics.addWater(ci, cj, 0.6);
    for (let i = 0; i < 200; i++) physics.minute();
    let outside = 0;
    for (let cj = 0; cj < C; cj++) for (let ci = 0; ci < C; ci++) if (!inHole(ci, cj)) outside += chunk.water[cellIndex(ci, cj)];
    expect(outside).toBeLessThan(0.001);
    // El lago queda plano
    const levels = [cellIndex(14, 14), cellIndex(16, 16), cellIndex(18, 18)].map(k => chunk.rock[k] + chunk.water[k]);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(0.01);
  });

  it('cae al mar de nubes por cualquier borde con agua', () => {
    const { world, chunk } = flatIsland();
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
    physics.addWater(0, 10, 0.5);
    // El agua se mueve cada 2 minutos de juego
    physics.minute();
    physics.minute();
    expect(chunk.drain[cellIndex(0, 10)]).toBeGreaterThan(0);
    let drained = sum(chunk.drain);
    for (let i = 0; i < 400; i++) {
      physics.minute();
      drained += sum(chunk.drain);
    }
    // En una meseta llana parte del agua se queda como lámina; lo que llega al borde, cae
    expect(drained).toBeGreaterThan(0.2);
    expect(sum(chunk.water) + drained).toBeCloseTo(0.5, 3);
  });

  it('solo hay barro por exceso: charco estancado sí, lago hondo no', () => {
    // Dos hoyos: uno con un charco poco profundo y otro hondo
    const { world, chunk } = flatIsland((ci, cj) => {
      if (ci >= 4 && ci <= 8 && cj >= 4 && cj <= 8) return 2.9;      // charco: 0,1 de profundidad
      if (ci >= 20 && ci <= 26 && cj >= 20 && cj <= 26) return 2;    // lago: 1 de profundidad
      return 3;
    });
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
    for (let cj = 4; cj <= 8; cj++) for (let ci = 4; ci <= 8; ci++) physics.addWater(ci, cj, 0.1);
    for (let cj = 20; cj <= 26; cj++) for (let ci = 20; ci <= 26; ci++) physics.addWater(ci, cj, 1);
    for (let i = 0; i < 4 * DAY; i++) physics.minute();
    expect(chunk.material[cellIndex(6, 6)]).toBe(Material.SOIL);      // el barro tarda semanas, no días
    for (let i = 0; i < 27 * DAY; i++) physics.minute();
    expect(chunk.material[cellIndex(6, 6)]).toBe(Material.MUD);
    expect(chunk.material[cellIndex(23, 23)]).toBe(Material.SOIL);
    expect(chunk.material[cellIndex(20, 23)]).toBe(Material.SOIL);    // orilla del lago: tampoco
  }, 20000);   // simula semanas de agua: en máquinas lentas pasa de los 5 s por defecto

  it('los lagos naturales (bajo el nivel freático) no se convierten en barro', () => {
    const world = new World(11, 1);
    const physics = new TerrainPhysics(world);
    const chunk = world.chunk(0, 0);
    const lakeBed = [...chunk.water].map((w, k) => (w > 0 ? k : -1)).filter(k => k >= 0);
    for (let i = 0; i < 4 * DAY; i++) physics.minute();
    expect(lakeBed.every(k => chunk.material[k] !== Material.MUD)).toBe(true);
  });

  it('el barro sin agua se seca y vuelve a tierra en unos días', () => {
    const { world, chunk } = flatIsland();
    const physics = new TerrainPhysics(world);
    const k = cellIndex(10, 10);
    chunk.material[k] = Material.MUD;
    physics.water.wake(10, 10);
    chunk.moisture[k] = 0.01;
    for (let i = 0; i < 4 * DAY; i++) physics.minute();
    expect(chunk.material[k]).toBe(Material.SOIL);
  });

  it('un río nuevo avanza despacio sobre tierra seca y deprisa sobre roca (frente de mojado)', () => {
    const slope = (ci: number): number => 2 + ci * 0.08;
    const crossing = (material: number): number => {
      const { world, chunk } = flatIsland(slope);
      for (let k = 0; k < C * C; k++) chunk.material[k] = material;
      const physics = new TerrainPhysics(world, { infiltration: true, evaporation: false, recharge: false, freezing: false });
      physics.setSpring(31, 16, 0.06);
      let m = 0;
      while (chunk.water[cellIndex(1, 16)] < 0.003 && m < 2000) { physics.minute(); m++; }
      return m;
    };
    const soil = crossing(Material.SOIL);
    // Objetivo: unas 15 h de juego por chunk sobre tierra seca (≈ 4 min reales a x1); sobre roca, menos de 2 h
    expect(soil).toBeGreaterThan(650);
    expect(soil).toBeLessThan(1200);
    expect(crossing(Material.ROCK)).toBeLessThan(soil / 2);
  });

  it('un charco se evapora con el calor', () => {
    const { world, chunk } = flatIsland();
    for (let t = 0; t < chunk.temperature.length; t++) chunk.temperature[t] = 0.9;
    const physics = new TerrainPhysics(world, { infiltration: false, evaporation: true, recharge: false, freezing: false });
    // Charco en un hoyo para que no se escurra
    chunk.rock[cellIndex(10, 10)] = 2.9;
    physics.addWater(10, 10, 0.08);
    for (let i = 0; i < DAY; i++) physics.minute();
    expect(chunk.water[cellIndex(10, 10)]).toBe(0);
  });

  describe('humus en la orilla', () => {
    it('una franja de humus frena la lámina de agua que avanza por el llano', () => {
      const run = (withHumus: boolean): number => {
        const { world, chunk } = flatIsland((ci) => 3 - ci * 0.01);      // llano con una caída mínima hacia la derecha
        if (withHumus) for (let cj = 0; cj < C; cj++) for (let ci = 12; ci < 15; ci++) chunk.material[cellIndex(ci, cj)] = Material.HUMUS;
        const physics = new TerrainPhysics(world, { infiltration: true, evaporation: false, recharge: false, freezing: false });
        physics.setSpring(4, 16, 0.008);
        for (let i = 0; i < 3 * DAY; i++) physics.minute();
        // Celdas mojadas (empapadas o con agua) más allá de la franja
        let beyond = 0;
        for (let cj = 0; cj < C; cj++) for (let ci = 16; ci < 28; ci++) {
          const k = cellIndex(ci, cj);
          if (chunk.moisture[k] > 0.5 || chunk.water[k] > 0.003) beyond++;
        }
        return beyond;
      };
      const without = run(false), with_ = run(true);
      expect(without).toBeGreaterThan(20);
      expect(with_).toBeLessThan(without * 0.2);
    });

    it('en agua honda el humus se hunde: no llega a la superficie ni une lagos', () => {
      const { world, chunk } = flatIsland((ci, cj) => (ci >= 8 && ci <= 20 && cj >= 8 && cj <= 20 ? 2 : 3));
      const physics = new TerrainPhysics(world, { infiltration: false, evaporation: false, recharge: false, freezing: false });
      for (let cj = 8; cj <= 20; cj++) for (let ci = 8; ci <= 20; ci++) physics.addWater(ci, cj, 0.8);
      for (let i = 0; i < 60; i++) physics.minute();
      for (let m = 0; m < 1440; m++) {
        for (let ci = 12; ci <= 16; ci++) SAND_EFFECTS[Sand.HUMUS].apply(physics, ci, 14, 1 / 1440 * 3, m / 1440);
        physics.minute();
      }
      for (let i = 0; i < DAY; i++) physics.minute();
      const surface = 2 + 0.8;
      for (let ci = 12; ci <= 16; ci++) {
        const k = cellIndex(ci, 14);
        expect(chunk.rock[k] + chunk.sediment[k]).toBeLessThan(surface - 0.1);
        expect(chunk.water[k]).toBeGreaterThan(0.1);
      }
    });
  });
});
