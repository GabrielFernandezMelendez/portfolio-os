import { World } from '../world/world';
import { VegetationSystem, plantCapacity, rootsAt } from './vegetation';
import { Stage, canGrowAt, eatFruit, invalidateLayout, layoutOf, remainsOf, stageOf, takeBirths, takeDeaths } from './plant-layout';
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

  it('la arena que cae de golpe mata la hierba en su sitio antes que un árbol', () => {
    const { chunk } = emptyForest();
    const all = () => true;
    chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('grass').id] = 0.9;
    chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('oak').id] = 0.9;
    const before = layoutOf(chunk, all);
    expect(before.some(p => p.plant === byKey('grass').id)).toBe(true);
    for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) chunk.sediment[cellIndex(8 + di, 8 + dj)] += 0.5;
    invalidateLayout(chunk);
    const after = layoutOf(chunk, all);
    expect(after.some(p => p.plant === byKey('grass').id)).toBe(false);
    expect(at(chunk, 2, 2, 'grass')).toBeLessThan(0.1);
    const oak = before.find(p => p.plant === byKey('oak').id)!;
    expect(after).toContain(oak);
    expect(at(chunk, 2, 2, 'oak')).toBeGreaterThan(0.4);
  });

  it('una planta inundada muere en su celda: no salta a otra y su biomasa baja', () => {
    const { chunk } = emptyForest();
    const all = () => true;
    const slot = tileIndex(3, 3) * PLANT_SLOTS + byKey('oak').id;
    chunk.plants[slot] = 1;
    const oak = layoutOf(chunk, all).find(p => p.plant === byKey('oak').id)!;
    // Se inunda la celda del roble (y sus vecinas)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) chunk.water[cellIndex(oak.ci + dx, oak.cj + dy)] = 0.4;
    invalidateLayout(chunk);
    const flooded = layoutOf(chunk, all);
    expect(flooded.some(p => p.plant === byKey('oak').id)).toBe(false);
    expect(chunk.plants[slot]).toBe(0);
    // Al retirarse el agua no aparece otro en otra celda (solo nacerá si la biomasa vuelve a crecer)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) chunk.water[cellIndex(oak.ci + dx, oak.cj + dy)] = 0;
    invalidateLayout(chunk);
    expect(layoutOf(chunk, all).some(p => p.plant === byKey('oak').id)).toBe(false);
  });

  it('el agua que aparece o se va alrededor no mueve las plantas que siguen vivas', () => {
    const { chunk } = emptyForest();
    const all = () => true;
    for (let t = 0; t < 64; t++) chunk.plants[t * PLANT_SLOTS + byKey('oak').id] = 1;
    const before = layoutOf(chunk, all).map(p => `${p.ci},${p.cj}`);
    // Un lago en una esquina: mueren los de dentro, los de fuera no se mueven
    for (let cj = 0; cj < 10; cj++) for (let ci = 0; ci < 10; ci++) chunk.water[cellIndex(ci, cj)] = 0.5;
    invalidateLayout(chunk);
    const during = layoutOf(chunk, all).map(p => `${p.ci},${p.cj}`);
    expect(during.length).toBeLessThan(before.length);
    for (const p of during) expect(before).toContain(p);
    // Se seca (Duna tapa el manantial): los supervivientes siguen exactamente donde estaban
    for (let cj = 0; cj < 10; cj++) for (let ci = 0; ci < 10; ci++) chunk.water[cellIndex(ci, cj)] = 0;
    invalidateLayout(chunk);
    expect(layoutOf(chunk, all).map(p => `${p.ci},${p.cj}`)).toEqual(during);
  });

  it('un charco de lluvia no mata una planta ya nacida', () => {
    const { chunk } = emptyForest();
    const all = () => true;
    chunk.plants[tileIndex(3, 3) * PLANT_SLOTS + byKey('oak').id] = 1;
    const oak = layoutOf(chunk, all).find(p => p.plant === byKey('oak').id)!;
    chunk.water[cellIndex(oak.ci, oak.cj)] = 0.03;
    invalidateLayout(chunk);
    expect(layoutOf(chunk, all)).toContain(oak);
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
    const all = () => true;
    const a = layoutOf(chunk, all).map(p => `${p.plant}:${p.ci},${p.cj}`);
    invalidateLayout(chunk);
    const b = layoutOf(chunk, all).map(p => `${p.plant}:${p.ci},${p.cj}`);
    expect(b).toEqual(a);
    const oak = layoutOf(chunk, all).find(p => p.plant === byKey('oak').id)!;
    for (const p of layoutOf(chunk, all)) if (p !== oak) expect(Math.max(Math.abs(p.ci - oak.ci), Math.abs(p.cj - oak.cj))).toBeGreaterThan(2);
  });

  it('solo en suelo llano y seco: nada en el agua (salvo juncos), ni en el borde de una terraza, ni junto al precipicio', () => {
    const { chunk } = emptyForest();
    const only00 = (cx: number, cy: number) => cx === 0 && cy === 0;
    // Un lago en el centro y una terraza a la derecha
    for (let cj = 12; cj < 20; cj++) for (let ci = 12; ci < 20; ci++) chunk.water[cellIndex(ci, cj)] = 0.4;
    for (let cj = 0; cj < 32; cj++) for (let ci = 24; ci < 32; ci++) chunk.rock[cellIndex(ci, cj)] = 3;
    expect(canGrowAt(chunk, 15, 15, 'bush', false, only00)).toBe(false);   // en el lago
    expect(canGrowAt(chunk, 11, 15, 'bush', false, only00)).toBe(false);   // en la orilla (vecina con agua)
    expect(canGrowAt(chunk, 11, 15, 'small', true, only00)).toBe(true);    // el junco sí
    for (let cj = 12; cj < 20; cj++) for (let ci = 12; ci < 20; ci++) chunk.water[cellIndex(ci, cj)] = 0.08;
    expect(canGrowAt(chunk, 12, 15, 'small', true, only00)).toBe(true);    // junco en la orilla del agua poco honda
    expect(canGrowAt(chunk, 15, 15, 'small', true, only00)).toBe(false);   // pero no en medio
    for (let cj = 12; cj < 20; cj++) for (let ci = 12; ci < 20; ci++) chunk.water[cellIndex(ci, cj)] = 0.4;
    expect(canGrowAt(chunk, 23, 5, 'small', false, only00)).toBe(false);   // al pie de la terraza
    expect(canGrowAt(chunk, 0, 5, 'small', false, only00)).toBe(false);    // en el borde de la isla
    expect(canGrowAt(chunk, 1, 5, 'tree', false, only00)).toBe(false);     // los árboles necesitan más margen
    expect(canGrowAt(chunk, 0, 5, 'small', false, () => true)).toBe(true); // si el vecino está descubierto, no es borde
    expect(canGrowAt(chunk, 6, 6, 'tree', false, only00)).toBe(true);
    // Y el reparto lo respeta
    for (let t = 0; t < 64; t++) for (const p of PLANT_DEFS) chunk.plants[t * PLANT_SLOTS + p.id] = p.biomes['forest'] ? 1 : 0;
    invalidateLayout(chunk);
    for (const p of layoutOf(chunk, only00)) {
      expect(canGrowAt(chunk, p.ci, p.cj, PLANT_DEFS[p.plant].kind, !!PLANT_DEFS[p.plant].shore, only00)).toBe(true);
    }
  });

  describe('ciclo de vida de cada planta', () => {
    const all = () => true;
    const DAY = 1440;

    it('la vegetación inicial ya está crecida, pero lo que nace después empieza como semilla y crece por etapas', () => {
      const { chunk } = emptyForest();
      chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('oak').id] = 1;
      const first = layoutOf(chunk, all, 0);
      expect(stageOf(first[0], 0)).toBe(Stage.ADULT);
      expect(takeBirths(chunk)).toEqual([]);
      chunk.plants[tileIndex(5, 5) * PLANT_SLOTS + byKey('oak').id] = 1;
      invalidateLayout(chunk);
      const born = layoutOf(chunk, all, 10 * DAY).find(p => p.ci >= 20 && p.cj >= 20)!;
      expect(takeBirths(chunk)).toEqual([born]);
      expect(stageOf(born, 10 * DAY)).toBe(Stage.SEED);
      expect(stageOf(born, 12 * DAY)).toBe(Stage.SPROUT);
      expect(stageOf(born, 15 * DAY)).toBe(Stage.YOUNG);
      expect(stageOf(born, 21 * DAY)).toBe(Stage.ADULT);
    });

    it('una biomasa que oscila en el límite no hace morir y renacer plantas', () => {
      const { chunk } = emptyForest();
      const slot = tileIndex(3, 3) * PLANT_SLOTS + byKey('oak').id;
      chunk.plants[slot] = 1;
      layoutOf(chunk, all, 0);
      for (let n = 0; n < 20; n++) {
        chunk.plants[slot] = n % 2 ? 0.55 : 1;
        invalidateLayout(chunk);
        layoutOf(chunk, all, n * 60);
      }
      expect(takeDeaths(chunk)).toEqual([]);
      expect(takeBirths(chunk)).toEqual([]);
    });

    it('cada muerte tiene su causa y sus restos: inundado deja tronco, seco deja tocón, enterrado nada', () => {
      const { chunk } = emptyForest();
      for (const [i, j] of [[1, 1], [4, 1], [1, 4]]) chunk.plants[tileIndex(i, j) * PLANT_SLOTS + byKey('oak').id] = 1;
      const oaks = layoutOf(chunk, all, 0).filter(p => p.plant === byKey('oak').id);
      expect(oaks.length).toBe(3);
      const [a, b, c] = oaks;
      chunk.water[cellIndex(a.ci, a.cj)] = 0.5;                                   // inundado
      chunk.plants[tileIndex(Math.floor(b.ci / 4), Math.floor(b.cj / 4)) * PLANT_SLOTS + byKey('oak').id] = 0.1;   // se seca
      chunk.sediment[cellIndex(c.ci, c.cj)] += 2;                                // enterrado
      invalidateLayout(chunk);
      layoutOf(chunk, all, DAY);
      const causes = Object.fromEntries(takeDeaths(chunk).map(d => [`${d.inst.ci},${d.inst.cj}`, d.cause]));
      expect(causes[`${a.ci},${a.cj}`]).toBe('flood');
      expect(causes[`${b.ci},${b.cj}`]).toBe('withered');
      expect(causes[`${c.ci},${c.cj}`]).toBe('buried');
      const remains = Object.fromEntries(remainsOf(chunk).map(r => [`${r.inst.ci},${r.inst.cj}`, r.kind]));
      expect(remains).toEqual({ [`${a.ci},${a.cj}`]: 'log', [`${b.ci},${b.cj}`]: 'stump' });
      // Los restos caducan con los días
      invalidateLayout(chunk);
      layoutOf(chunk, all, 30 * DAY);
      expect(remainsOf(chunk)).toEqual([]);
    });

    it('entre dos árboles queda al menos una casilla del cursor libre', () => {
      const { chunk } = emptyForest();
      for (let t = 0; t < 64; t++) chunk.plants[t * PLANT_SLOTS + byKey('oak').id] = 1;
      const trees = layoutOf(chunk, all, 0).filter(p => PLANT_DEFS[p.plant].kind === 'tree');
      expect(trees.length).toBeGreaterThan(20);
      for (const p of trees) for (const q of trees) {
        if (p !== q) expect(Math.max(Math.abs(p.ci - q.ci), Math.abs(p.cj - q.cj))).toBeGreaterThan(3);
      }
    });

    it('el fruto comido se apunta en cada planta que da comida', () => {
      const { chunk } = emptyForest();
      chunk.plants[tileIndex(2, 2) * PLANT_SLOTS + byKey('redBerries').id] = 1;
      const [bush] = layoutOf(chunk, all, 0);
      expect(bush.eatenAt).toBe(-Infinity);
      expect(eatFruit(chunk, 500)).toBe(1);
      expect(bush.eatenAt).toBe(500);
    });
  });
});
