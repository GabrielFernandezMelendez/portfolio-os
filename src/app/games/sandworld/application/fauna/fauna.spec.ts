import { FaunaSystem } from './fauna-system';
import { FaunaWorld, Meal } from '../../domain/ports/fauna-world.port';
import { Diet } from '../../domain/models/plant.model';
import { SeasonId, Season, toGameTime, DAYS_PER_YEAR } from '../../domain/models/time.model';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { PLANT_DEFS } from '../../config/plants.config';
import { SPECIES_DEFS } from '../../config/species.config';
import { lifeStage } from './needs';
import { litterSize, tryConceive } from './breeding';
import { SeasonBreeding } from '../../domain/models/species.model';
import { animalView } from './animal-view';
import { herdMarks, leaderOf } from './herds';
import { catchChance, smellChance } from './predation';
import { MEAT_BY_SIZE } from '../../config/fauna.config';
import { arrivalChance, crowdLeaveChance, leaveChance, speciesCap } from './migration';
import { RUN_STOP } from '../../config/fauna.config';
import { Material } from '../../domain/models/material.model';
import { BurntBorn } from './burnt-born';
import { carcassState, eatenOf } from './carcass';
import { BurntLand, BurntRegion } from '../../domain/ports/burnt-land.port';

const DAY = 1440;
const G = 4;
const GRASS = PLANT_DEFS.find(p => p.key === 'grass')!;
const SHROOM = PLANT_DEFS.find(p => p.key === 'swampShroom')!;
const deer = SPECIES_DEFS[0];
/** Lo que vuelve a crecer la hierba al día por estación (como SEASON_GROWTH / growthDays de la hierba) */
const REGROW = [0.2, 0.14, 0.07, 0];

/**
 * Isla de mentira: `tiles` × `tiles` tiles de hierba, toda pisable, con un lago opcional en una esquina.
 * La hierba se come, se pisa y vuelve a crecer cada hora según la estación (en invierno, nada).
 */
class FakeIsland implements FaunaWorld {
  readonly grass: Float32Array;
  readonly shroom: Float32Array;
  water = new Set<string>();
  fire = new Set<string>();
  /** Tiles con árboles ("i,j"): refugio */
  trees = new Set<string>();
  snow = false;
  constructor(readonly tiles: number, grass = 0.8) {
    this.grass = new Float32Array(tiles * tiles).fill(grass);
    this.shroom = new Float32Array(tiles * tiles);
  }
  private t(gx: number, gy: number): number {
    const i = Math.floor(gx / G), j = Math.floor(gy / G);
    return i < 0 || j < 0 || i >= this.tiles || j >= this.tiles ? -1 : j * this.tiles + i;
  }
  walkable(gx: number, gy: number): boolean { return this.t(gx, gy) >= 0 && !this.water.has(`${gx},${gy}`); }
  /** Alturas por celda ("x,y"), para probar la arena que se asienta encima de una entrada */
  heights = new Map<string, number>();
  height(gx: number, gy: number): number { return this.heights.get(`${gx},${gy}`) ?? 0; }
  foodAt(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>): number {
    const t = this.t(gx, gy);
    if (t < 0) return 0;
    // Hierba solo para quien pasta (un lobo no come hierba)
    let f = diets.includes('grazer') || diets.includes('omnivore') ? Math.max(0, this.grass[t] - 0.02) * GRASS.food!.nutrition : 0;
    if (!avoid.has(SHROOM.id) && diets.includes('browser')) f += this.shroom[t] * SHROOM.food!.nutrition;
    return f;
  }
  eat(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>, want: number): Meal | null {
    const t = this.t(gx, gy);
    if (t < 0) return null;
    if (this.shroom[t] > 0.01 && !avoid.has(SHROOM.id)) {
      const b = Math.min(this.shroom[t], want / SHROOM.food!.nutrition);
      this.shroom[t] -= b;
      return { food: b * SHROOM.food!.nutrition, plant: SHROOM.id, fruit: false };
    }
    if (this.grass[t] <= 0.025 || !(diets.includes('grazer') || diets.includes('omnivore'))) return null;
    const b = Math.min(this.grass[t] - 0.02, want / GRASS.food!.nutrition);
    this.grass[t] -= b;
    return { food: b * GRASS.food!.nutrition, plant: GRASS.id, fruit: false };
  }
  nearestWater(gx: number, gy: number, max: number, skip?: (x: number, y: number) => boolean) {
    let best: { x: number; y: number; distance: number } | null = null;
    for (const k of this.water) {
      const [x, y] = k.split(',').map(Number);
      const d = Math.hypot(x - gx, y - gy);
      if (skip?.(x, y)) continue;
      if (d <= max && (!best || d < best.distance)) best = { x, y, distance: d };
    }
    return best;
  }
  danger(gx: number, gy: number) {
    const k = `${Math.floor(gx / G)},${Math.floor(gy / G)}`;
    return this.fire.has(k) ? { level: 1, fromX: gx, fromY: gy - 1 } : { level: 0, fromX: gx, fromY: gy };
  }
  trample(gx: number, gy: number, amount: number): void {
    const t = this.t(gx, gy);
    if (t >= 0) this.grass[t] *= 1 - amount;
  }
  shelterNear(gx: number, gy: number, max: number) {
    let best: { x: number; y: number; d: number } | null = null;
    for (const k of this.trees) {
      const [i, j] = k.split(',').map(Number);
      const x = (i + 0.5) * G, y = (j + 0.5) * G, d = Math.hypot(x - gx, y - gy);
      if (d <= max && (!best || d < best.d)) best = { x, y, d };
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  snowAt(): boolean { return this.snow; }
  /** Todo es tierra que se puede cavar, salvo las celdas de `rock` */
  rock = new Set<string>();
  materialAt(gx: number, gy: number) { return this.t(gx, gy) < 0 ? null : this.rock.has(`${gx},${gy}`) ? Material.ROCK : Material.SOIL; }
  flooded(gx: number, gy: number): boolean { return this.water.has(`${gx},${gy}`); }
  dropSeed(): void {}
  fertilize(): void {}
  /** Sin orilla (por defecto) no llega ni se va nadie: las pruebas de llegadas la activan */
  chunks = 0;
  coast: { x: number; y: number } | null = null;
  islandChunks(): number { return this.chunks; }
  frozen = new Set<string>();
  frozenAt(gx: number, gy: number): boolean { return this.frozen.has(`${Math.floor(gx / G)},${Math.floor(gy / G)}`); }
  fed = 0;
  /** Temperatura de toda la isla (templado por defecto) */
  temp = 0.5;
  temperature(): number { return this.temp; }
  feedBurnt(_gx: number, _gy: number, amount: number): void { this.fed += amount; }
  shore() { return this.coast; }
  totalFood(diets: readonly Diet[]): number {
    let s = 0;
    for (let t = 0; t < this.grass.length; t++) s += this.foodAt((t % this.tiles) * G, Math.floor(t / this.tiles) * G, diets, new Set());
    return s;
  }
  regrow(season: SeasonId, hours: number): void {
    for (let t = 0; t < this.grass.length; t++) this.grass[t] = Math.min(1, this.grass[t] + (REGROW[season] * hours) / 24 * (this.grass[t] > 0.005 ? 1 : 0));
  }
  totalGrass(): number {
    return this.grass.reduce((s, v) => s + v, 0);
  }
  /** Un lago de 3 × 3 celdas */
  pond(gx: number, gy: number): void {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) this.water.add(`${gx + x},${gy + y}`);
  }
}

/** Minuto de inicio de una estación del primer año, a las 9:00 */
const at = (season: SeasonId, day = 0) => (season * 30 + day) * DAY + 9 * 60;

function setup(tiles: number, grass = 0.8, seed = 7) {
  const island = new FakeIsland(tiles, grass);
  island.pond(tiles * G / 2, tiles * G / 2 + 6);
  const fauna = new FaunaSystem(island, new SeededRandom(seed));
  return { island, fauna };
}

/** Avanza `minutes` minutos desde `from` (la hierba vuelve a crecer cada hora). Devuelve el minuto final. */
function run(fauna: FaunaSystem, island: FakeIsland, from: number, minutes: number, onDay?: (day: number) => void): number {
  for (let m = from; m < from + minutes; m++) {
    const t = toGameTime(m);
    fauna.minute(t);
    if (t.minute === 0) island.regrow(t.season, 1);
    if (t.minuteOfDay === 0 && onDay) onDay(t.day);
  }
  return from + minutes;
}

describe('Fauna: ciervos', () => {
  it('una manada de fundadores: 2 hembras, 1 macho y 1 cría que sigue a su madre', () => {
    const { fauna } = setup(8);
    const herd = fauna.spawnHerd('deer', 16, 16, at(Season.SPRING));
    expect(herd.length).toBe(4);
    expect(herd.filter(a => a.sex === 'female').length).toBe(3);
    const calf = herd.find(a => lifeStage(a, deer, at(Season.SPRING)) === 'young')!;
    expect(calf.mother).not.toBeNull();
    expect(new Set(herd.map(a => a.herd)).size).toBe(1);
    expect(new Set(herd.map(a => a.name)).size).toBe(4);
    expect(fauna.news.some(n => n.type === 'arrived')).toBe(true);
  });

  it('la ficha: una foto del animal con sus barras, su manada y la línea de la vida (sin su vida oculta)', () => {
    const { fauna } = setup(8);
    const t0 = at(Season.SPRING);
    const herd = fauna.spawnHerd('deer', 16, 16, t0);
    const leader = leaderOf(herd, deer, t0)!;
    const other = herd.find(a => a !== leader)!;
    const v = animalView(fauna, other.id, t0)!;
    expect(v.alive).toBe(true);
    expect(v.herdSize).toBe(4);
    expect(v.leader).toBe(leader.name);
    expect(v.life).toBeLessThan(1);
    expect(v.marks[0]).toBeLessThan(v.marks[1]);
    expect(Object.keys(v)).not.toContain('lifespan');
    expect(v.diary[0].key).toBe('arrived');
    expect(animalView(fauna, 999, t0)).toBeNull();
  });

  it('comen hierba (la hierba baja), se sacian y la crónica cuenta qué comen', () => {
    const { island, fauna } = setup(8, 1);
    const t0 = at(Season.SPRING);
    const herd = fauna.spawnHerd('deer', 16, 16, t0);
    for (const a of herd) a.satiety = 0.2;
    const before = island.totalGrass();
    run(fauna, island, t0, 6 * 60);
    expect(island.totalGrass()).toBeLessThan(before);
    expect(herd.every(a => a.satiety > 0.4)).toBe(true);
    expect(fauna.news.some(n => n.type === 'discovered' && n.plant === GRASS.id)).toBe(true);
  });

  it('se mantienen en manada y duermen de noche', () => {
    const { island, fauna } = setup(16);
    const t0 = at(Season.SUMMER);
    const herd = fauna.spawnHerd('deer', 30, 30, t0);
    const end = run(fauna, island, t0, 2 * DAY);
    const cx = herd.reduce((s, a) => s + a.x, 0) / herd.length, cy = herd.reduce((s, a) => s + a.y, 0) / herd.length;
    for (const a of herd) expect(Math.hypot(a.x - cx, a.y - cy)).toBeLessThan(deer.herd.cohesion * 4);
    // A las 2 de la madrugada, dormidos
    const night = end - (end % DAY) + DAY + 2 * 60;
    run(fauna, island, end, night - end);
    expect(herd.filter(a => a.action === 'sleep').length).toBeGreaterThanOrEqual(3);
  });

  it('sin comida pasan hambre, pierden vida y mueren (la cría antes)', () => {
    const { island, fauna } = setup(8, 0);
    const t0 = at(Season.WINTER);
    const herd = fauna.spawnHerd('deer', 16, 16, t0);
    let calfDied = -1, firstAdult = -1;
    run(fauna, island, t0, 12 * DAY, () => {
      const calf = herd.find(a => a.mother !== null)!;
      if (calfDied < 0 && calf.diedAt !== null) calfDied = calf.diedAt;
      const adult = herd.find(a => a.mother === null && a.diedAt !== null);
      if (firstAdult < 0 && adult) firstAdult = adult.diedAt!;
    });
    expect(fauna.animals.length).toBe(0);
    expect(fauna.corpses.every(a => a.cause === 'starvation')).toBe(true);
    expect(calfDied).toBeLessThan(firstAdult);
  });

  it('con sed van a beber al agua por su cuenta y se recuperan; sin agua mueren de sed', () => {
    const { island, fauna } = setup(16);
    const t0 = at(Season.SUMMER);
    const herd = fauna.spawnHerd('deer', 20, 20, t0);
    for (const a of herd) { a.hydration = 0.2; a.satiety = 0.9; }
    run(fauna, island, t0, 8 * 60);
    expect(herd.every(a => a.hydration > 0.6)).toBe(true);
    expect(herd.some(a => Math.hypot(a.x - 33, a.y - 39) < 4)).toBe(true);   // estuvieron en la orilla del lago
    // Isla sin agua
    const dry = setup(8, 1);
    dry.island.water.clear();
    const lost = dry.fauna.spawnHerd('deer', 16, 16, t0);
    run(dry.fauna, dry.island, t0, 6 * DAY);
    expect(lost.every(a => a.cause === 'dehydration')).toBe(true);
  });

  it('una planta tóxica envenena y la manada aprende a evitarla', () => {
    const { island, fauna } = setup(8, 0);
    island.shroom.fill(0.5);
    const t0 = at(Season.SPRING);
    const herd = fauna.spawnHerd('deer', 16, 16, t0);
    for (const a of herd) a.satiety = 0.3;
    run(fauna, island, t0, 2 * DAY);
    expect(fauna.news.some(n => n.type === 'poisoned')).toBe(true);
    expect(fauna.herds.get(herd[0].herd)?.avoid.has(SHROOM.id)).toBe(true);
    expect(herd.some(a => a.diary.some(d => d.key === 'poison.confused'))).toBe(true);
  });

  it('órdenes: comer y dormir; correr lleva lejos (una isla), cansa y deja jadeando, pero no dormido', () => {
    const { island, fauna } = setup(24);
    const t0 = at(Season.SUMMER);
    const herd = fauna.spawnHerd('deer', 48, 48, t0);
    const [a, b, c] = herd;
    b.satiety = 0.7;
    expect(fauna.order(b.id, 'eat', t0)).toBe(true);
    expect(fauna.order(c.id, 'sleep', t0)).toBe(true);
    expect(c.action).toBe('sleep');
    // Cansado no puede correr
    a.rest = 0.2;
    expect(fauna.order(a.id, 'run', t0)).toBe(false);
    // Algo cansado sí: acaba la carrera agotado, pero con la adrenalina no se duerme
    a.rest = 0.4;
    expect(fauna.order(a.id, 'run', t0)).toBe(true);
    const x0 = a.x, y0 = a.y;
    run(fauna, island, t0, 50);
    expect(a.action).not.toBe('run');
    expect(Math.hypot(a.x - x0, a.y - y0)).toBeGreaterThan(14);
    expect(a.diary.some(d => d.key === 'ran')).toBe(true);
    run(fauna, island, t0 + 50, 60);
    expect(a.action).not.toBe('sleep');
    expect(b.satiety).toBeGreaterThan(0.8);
  });

  it('huyen del fuego', () => {
    const { island, fauna } = setup(16);
    const t0 = at(Season.SUMMER);
    const herd = fauna.spawnHerd('deer', 30, 30, t0);
    for (const a of herd) island.fire.add(`${Math.floor(a.x / G)},${Math.floor(a.y / G)}`);
    run(fauna, island, t0, 10);
    expect(herd.filter(a => a.action === 'run').length).toBeGreaterThanOrEqual(3);
  });

  it('celo en otoño con mucha comida: quedan preñadas casi todas y las crías nacen en primavera', () => {
    const { island, fauna } = setup(24, 1, 3);
    for (const x of [16, 48, 80]) island.pond(x, 30);   // agua cerca de cada manada
    const t0 = at(Season.AUTUMN);
    const herds = [0, 1, 2, 3, 4].map(n => fauna.spawnHerd('deer', 12 + n * 16, 40, t0));
    const females = herds.flat().filter(a => a.sex === 'female' && a.mother === null);
    run(fauna, island, t0, 30 * DAY);
    const pregnant = females.filter(f => f.dueAt !== null);
    expect(pregnant.length).toBeGreaterThanOrEqual(females.length - 2);
    // Nacen en primavera, no antes
    for (const f of pregnant) expect(toGameTime(f.dueAt!).season).toBe(Season.SPRING);
    const pop = fauna.animals.length;
    run(fauna, island, at(Season.WINTER), 45 * DAY);
    const born = fauna.news.filter(n => n.type === 'born');
    expect(born.length).toBeGreaterThanOrEqual(pregnant.length);
    expect(fauna.animals.length).toBeGreaterThan(pop);
  }, 20000);

  it('gemelos solo si la madre está muy bien comida en el celo', () => {
    const { fauna } = setup(8);
    const t0 = at(Season.AUTUMN);
    const herd = fauna.spawnHerd('deer', 16, 16, t0);
    const [f] = herd;
    const always = { next: () => 0 };
    f.satiety = 0.9; f.happiness = 0.8;
    expect(tryConceive(f, herd, deer, t0, 1, 1, always)).not.toBeNull();
    expect(f.litter).toBe(2);
    expect(toGameTime(f.dueAt!).season).toBe(Season.SPRING);
    const g = herd.find(a => a !== f && a.sex === 'female' && a.mother === null)!;
    g.satiety = 0.6; g.happiness = 0.8;
    expect(tryConceive(g, herd, deer, t0, 1, 1, always)).not.toBeNull();
    expect(g.litter).toBe(1);
    // Con hambre o triste, no
    const h = { ...g, dueAt: null, lastRutYear: -1, satiety: 0.3 };
    expect(tryConceive(h, herd, deer, t0, 1, 1, always)).toBeNull();
  });

  it('sin macho adulto no hay crías aunque sobre comida', () => {
    const { island, fauna } = setup(16, 1);
    const t0 = at(Season.AUTUMN);
    const herd = fauna.spawnHerd('deer', 30, 30, t0);
    herd.find(a => a.sex === 'male')!.health = 0;
    run(fauna, island, t0, 30 * DAY);
    expect(fauna.animals.filter(a => a.dueAt !== null).length).toBe(0);
  });

  it('el riesgo doble: con mucha comida en otoño se pasan, y el invierno trae hambruna y prado arrasado', () => {
    // Isla pequeña (8 × 8 tiles) llena de hierba y 6 manadas: sobra comida en otoño, falta en invierno
    const { island, fauna } = setup(8, 1, 11);
    const t0 = at(Season.AUTUMN);
    for (let n = 0; n < 6; n++) fauna.spawnHerd('deer', 6 + (n % 3) * 10, 8 + Math.floor(n / 3) * 12, t0);
    const start = fauna.animals.length;
    const density0 = fauna.stats()[0].density;
    run(fauna, island, t0, 60 * DAY);
    const deaths = fauna.news.filter(n => n.type === 'died' && n.cause === 'starvation').length + fauna.corpses.filter(c => c.cause === 'starvation').length;
    expect(density0).toBeLessThan(fauna.stats()[0].density + 10);
    expect(fauna.news.some(n => n.type === 'hunger')).toBe(true);
    expect(deaths).toBeGreaterThan(start / 4);
    expect(island.totalGrass() / island.grass.length).toBeLessThan(0.25);
  }, 20000);

  it('una manada en una isla sana no se extingue en dos años y crece con calma', () => {
    const { island, fauna } = setup(16, 0.8, 5);
    const t0 = at(Season.SPRING);
    fauna.spawnHerd('deer', 30, 30, t0);
    const counts: number[] = [];
    run(fauna, island, t0, 2 * DAYS_PER_YEAR * DAY, day => { if (day % 30 === 0) counts.push(fauna.animals.length); });
    expect(fauna.animals.length).toBeGreaterThan(0);
    expect(fauna.news.some(n => n.type === 'born')).toBe(true);
    expect(Math.max(...counts)).toBeLessThan(40);
  }, 20000);

  // ── Comportamientos comunes: espacio, estímulos y tiempo ──

  const meanNearest = (herd: { x: number; y: number }[]) =>
    herd.reduce((t, a) => t + Math.min(...herd.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y))), 0) / herd.length;

  it('correr con toda la manada: ~3 de cada 4 salen juntos y el resto se separa (probabilidad, no regla)', () => {
    let adults = 0, split = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { fauna } = setup(24, 0.8, seed);
      const t0 = at(Season.SUMMER);
      const herd = fauna.spawnHerd('deer', 48, 48, t0);
      for (const a of herd) a.rest = 1;
      expect(fauna.orderHerd(herd[0].id, t0)).toBe(true);
      expect(herd.every(a => a.action === 'run')).toBe(true);
      const grown = herd.filter(a => a.mother === null);
      adults += grown.length;
      split += grown.filter(a => a.strayed === 1).length;
      // La cría corre con su madre (y como ella)
      const calf = herd.find(a => a.mother !== null)!, mum = herd.find(a => a.id === calf.mother)!;
      expect(calf.strayed).toBe(mum.strayed);
      expect(fauna.news.some(n => n.type === 'herdRun')).toBe(true);
    }
    expect(split / adults).toBeGreaterThan(0.15);
    expect(split / adults).toBeLessThan(0.35);
  });

  it('el que se separa anda por su cuenta y al caer la tarde encuentra a los suyos o pasa la noche perdido', () => {
    let found = 0, lost = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { island, fauna } = setup(40, 0.8, seed);
      const t0 = at(Season.SUMMER, 2) - 9 * 60 + 10 * 60;       // 10:00
      const herd = fauna.spawnHerd('deer', 80, 80, t0);
      for (const a of herd) a.rest = 1;
      fauna.orderHerd(herd[0].id, t0);
      const strays = herd.filter(a => a.strayed === 1 && a.mother === null);
      run(fauna, island, t0, 17 * 60);                          // hasta las 3:00
      for (const a of strays) {
        if (a.diary.some(d => d.key === 'foundHerd')) found++;
        if (fauna.news.some(n => n.type === 'lost' && n.id === a.id)) lost++;
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  });

  it('vista de lejos: una moneda por manada, en su guía y con cuántos son', () => {
    const { fauna } = setup(24);
    const t0 = at(Season.SUMMER);
    const one = fauna.spawnHerd('deer', 20, 20, t0);
    const two = fauna.spawnHerd('deer', 70, 70, t0);
    const marks = herdMarks(fauna.animals, SPECIES_DEFS, t0);
    expect(marks.length).toBe(2);
    for (const herd of [one, two]) {
      const lead = leaderOf(herd, deer, t0)!;
      const m = marks.find(k => k.leader === lead.id)!;
      expect(m.count).toBe(herd.length);
      expect([m.x, m.y]).toEqual([lead.x, lead.y]);
    }
  });

  it('pastando guardan su espacio; de noche se apiñan', () => {
    const { island, fauna } = setup(24);
    const t0 = at(Season.SUMMER, 1) - 9 * 60 + 10 * 60;     // 10:00
    const herd = fauna.spawnHerd('deer', 40, 40, t0);
    let day = 0, night = 0;
    const end = run(fauna, island, t0, 5 * 60);
    const adults = herd.filter(a => a.mother === null);     // la cría va pegada a su madre
    day = meanNearest(adults);
    run(fauna, island, end, 14 * 60);                      // hasta las 3:00
    night = meanNearest(adults);
    expect(day).toBeGreaterThan(1.8);
    expect(night).toBeLessThan(day);
  });

  it('un susto: huyen lejos (hasta ponerse a salvo), se paran a mirar atrás y la alarma se contagia', () => {
    const { island, fauna } = setup(32);
    const t0 = at(Season.SPRING, 3);
    const herd = fauna.spawnHerd('deer', 64, 64, t0);
    run(fauna, island, t0, 30);
    const first = herd[0];
    const sx = first.x + 1, sy = first.y;
    // Arena que cae justo al lado de uno solo (alcance corto): los demás se asustan por contagio
    fauna.sense({ type: 'sandFall', gx: sx, gy: sy, strength: 1 }, t0 + 30);
    expect(first.signal?.kind).toBe('alarm');
    run(fauna, island, t0 + 30, 10);
    expect(herd.filter(a => a.action === 'run').length).toBeGreaterThanOrEqual(3);
    expect(fauna.news.some(n => n.type === 'stampede')).toBe(true);
    run(fauna, island, t0 + 40, 120);
    expect(herd.every(a => a.action !== 'run')).toBe(true);
    // Han puesto al menos media isla de por medio (no dos pasos) y no han caído rendidos
    const far = herd.filter(a => a.mother === null).map(a => Math.hypot(a.x - sx, a.y - sy));
    expect(Math.max(...far)).toBeGreaterThan(deer.range.flee * 32 * 0.5);
    expect(herd.every(a => a.rest > RUN_STOP + 0.05)).toBe(true);
    expect(herd.every(a => a.action !== 'sleep')).toBe(true);
    expect(herd.some(a => a.diary.some(d => d.key === 'scare.sandFall'))).toBe(true);
  });

  it('de día exploran por su cuenta (lejos de la manada) y por la noche vuelven a dormir juntos', () => {
    const { island, fauna } = setup(40);
    const t0 = at(Season.SUMMER, 2) - 9 * 60 + 6 * 60;      // 6:00
    const herd = fauna.spawnHerd('deer', 80, 80, t0);
    for (const a of herd) a.rest = 1;
    let farthest = 0, explored = false;
    let m = t0;
    // De 6:00 a 18:00: alguien se aleja bastante más de lo que se abre la manada pastando
    for (; m < t0 + 12 * 60; m += 30) {
      run(fauna, island, m, 30);
      const leader = leaderOf(herd, deer, m);
      for (const a of herd) if (leader && a !== leader) farthest = Math.max(farthest, Math.hypot(a.x - leader.x, a.y - leader.y));
      explored ||= herd.some(a => a.roam !== null);
    }
    expect(explored).toBe(true);
    expect(farthest).toBeGreaterThan(deer.herd.cohesion * deer.spacing.graze * 2);
    expect(farthest).toBeLessThan(deer.range.roam * 32 * 1.3);
    expect(herd.some(a => a.diary.some(d => d.key === 'explore'))).toBe(true);
  });

  it('por la noche casi siempre vuelven a dormir juntos, pero no siempre: alguno se entretiene y duerme lejos', () => {
    let deerCount = 0, away = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { island, fauna } = setup(40, 0.8, seed);
      const t0 = at(Season.SUMMER, 2) - 9 * 60 + 6 * 60;    // 6:00
      const herd = fauna.spawnHerd('deer', 80, 80, t0);
      for (let night = 0; night < 3; night++) {
        const three = t0 + night * DAY + 21 * 60;             // 3:00 de la noche siguiente
        run(fauna, island, night === 0 ? t0 : three - DAY, DAY);
        const adults = herd.filter(a => a.mother === null && a.diedAt === null);
        const cx = adults.reduce((s, a) => s + a.x, 0) / adults.length, cy = adults.reduce((s, a) => s + a.y, 0) / adults.length;
        deerCount += adults.length;
        away += adults.filter(a => Math.hypot(a.x - cx, a.y - cy) > deer.herd.cohesion * 2).length;
      }
    }
    expect(away).toBeGreaterThan(0);
    expect(away / deerCount).toBeLessThan(0.3);
  });

  it('rodean un lago para volver (buscan camino) y quien no puede volver de noche se pierde', () => {
    const { island, fauna } = setup(24);
    const t0 = at(Season.SUMMER, 2) - 9 * 60 + 19 * 60;     // 19:00
    const herd = fauna.spawnHerd('deer', 20, 48, t0);
    const walker = herd.find(a => a.mother === null && leaderOf(herd, deer, t0) !== a)!;
    // Un lago alargado entre él y los suyos, con paso por abajo
    for (let y = 30; y < 80; y++) for (let x = 34; x < 38; x++) island.water.add(`${x},${y}`);
    walker.x = 50;
    walker.y = 48;
    run(fauna, island, t0, 6 * 60);
    expect(walker.x).toBeLessThan(34);
    // Ahora el lago cierra el paso del todo: el que se queda al otro lado pasa la noche perdido
    for (let y = 0; y < 96; y++) for (let x = 34; x < 38; x++) island.water.add(`${x},${y}`);
    const t1 = at(Season.SUMMER, 4) - 9 * 60 + 19 * 60;
    const lost = walker;
    lost.x = 60;
    lost.y = 48;
    run(fauna, island, t1, 8 * 60);
    expect(lost.x).toBeGreaterThan(38);
    expect(fauna.news.some(n => n.type === 'lost' && n.id === lost.id)).toBe(true);
  });

  it('se acostumbran a lo que se repite sin daño; lo que hace daño les vuelve a asustar del todo', () => {
    const { fauna } = setup(24);
    const t0 = at(Season.SPRING, 3);
    const [a] = fauna.spawnHerd('deer', 40, 40, t0);
    const scare = (m: number, hurt = 0) => {
      a.fear = 0;
      fauna.sense({ type: 'dig', gx: a.x + 3, gy: a.y, strength: 1, hurtRadius: hurt }, m);
      return a.fear;
    };
    const firstFear = scare(t0);
    for (let n = 1; n < 6; n++) scare(t0 + n * 30);
    const used = scare(t0 + 200);
    expect(used).toBeLessThan(firstFear * 0.5);
    scare(t0 + 230, 5);                                    // esta vez hace daño
    expect(scare(t0 + 260)).toBeGreaterThan(used);
  });

  it('la Duna que cae encima hace daño; el rayo cerca hiere y la manada evita la zona', () => {
    const { island, fauna } = setup(24);
    const t0 = at(Season.SPRING, 3);
    const herd = fauna.spawnHerd('deer', 40, 40, t0);
    const [a, b] = herd;
    fauna.sense({ type: 'sandFall', gx: a.x, gy: a.y, strength: 1, hurtRadius: 1 }, t0);
    expect(a.health).toBeLessThan(1);
    expect(a.diary[0].key).toBe('buried');
    fauna.sense({ type: 'lightning', gx: b.x, gy: b.y, strength: 1, hurtRadius: 1 }, t0 + 1);
    expect(b.health).toBeLessThan(0.5);
    const zones = fauna.herds.get(b.herd)!.zones;
    expect(zones.length).toBeGreaterThan(0);
    run(fauna, island, t0 + 1, 3 * 60);
    // No se quedan dentro de la zona del rayo
    const z = zones[zones.length - 1];
    expect(herd.filter(x => x.diedAt === null && Math.hypot(x.x - z.x, x.y - z.y) < z.r).length).toBeLessThanOrEqual(1);
  });

  it('un manantial nuevo: primero el susto y luego van a mirar', () => {
    const { island, fauna } = setup(24);
    const t0 = at(Season.SPRING, 3);
    const herd = fauna.spawnHerd('deer', 40, 40, t0);
    fauna.sense({ type: 'spring', gx: 46, gy: 40, strength: 1 }, t0);
    expect(herd.some(a => a.fear > 0)).toBe(true);
    let closest = Infinity;
    for (let m = t0; m < t0 + 5 * 60; m++) {
      fauna.minute(toGameTime(m));
      for (const a of herd) closest = Math.min(closest, Math.hypot(a.x - 46, a.y - 40));
    }
    expect(closest).toBeLessThan(2.5);
  });

  it('con tormenta no duermen y se refugian bajo los árboles; con calor sestean a la sombra', () => {
    const { island, fauna } = setup(24);
    island.trees.add('12,10');
    const night = at(Season.SPRING, 3) - 9 * 60 + 23 * 60;    // 23:00
    const herd = fauna.spawnHerd('deer', 40, 40, night);
    fauna.conditions = { rain: 1, storm: true, snow: false, cold: false, hot: false, drought: false };
    run(fauna, island, night, 3 * 60);
    expect(herd.filter(a => a.action === 'sleep').length).toBe(0);
    expect(herd.some(a => Math.hypot(a.x - 50, a.y - 42) < 4)).toBe(true);
    // Calor a mediodía
    const hot = setup(24);
    hot.island.trees.add('12,10');
    const noon = at(Season.SUMMER, 3) - 9 * 60 + 12 * 60;
    const herd2 = hot.fauna.spawnHerd('deer', 44, 40, noon);
    for (const a of herd2) { a.satiety = 0.9; a.hydration = 0.9; }
    hot.fauna.conditions = { rain: 0, storm: false, snow: false, cold: false, hot: true, drought: false };
    run(hot.fauna, hot.island, noon, 2 * 60);
    expect(herd2.filter(a => a.action === 'sleep').length).toBeGreaterThanOrEqual(2);
    expect(herd2.some(a => a.diary.some(d => d.key === 'siesta'))).toBe(true);
  });
});

describe('Fauna: conejos', () => {
  const rabbit = SPECIES_DEFS[1];
  const hourOf = (season: SeasonId, day: number, hour: number) => (season * 30 + day) * DAY + hour * 60;

  it('cavan su madriguera, duermen dentro de día y salen a comer de noche', () => {
    const { island, fauna } = setup(16);
    const t0 = hourOf(Season.SUMMER, 1, 20);
    const colony = fauna.spawnHerd('rabbit', 30, 30, t0);
    expect(colony.length).toBe(5);
    // Sin madriguera, la cavan (y tarda unas horas en estar lista)
    run(fauna, island, t0, 30);
    const herd = fauna.herds.get(colony[0].herd)!;
    expect(herd.burrow).not.toBeNull();
    expect(fauna.burrows.usable(herd, t0 + 30)).toBeUndefined();
    // Al día siguiente, a mediodía, casi todos dentro; a medianoche, casi todos fuera
    run(fauna, island, t0 + 30, hourOf(Season.SUMMER, 3, 12) - t0 - 30);
    expect(colony.filter(a => a.inside !== null).length).toBeGreaterThanOrEqual(3);
    run(fauna, island, hourOf(Season.SUMMER, 3, 12), 12 * 60);
    expect(colony.filter(a => a.inside === null).length).toBeGreaterThanOrEqual(3);
  });

  it('al amanecer casi todos vuelven a la madriguera, pero alguno se entretiene y duerme fuera', () => {
    let total = 0, outside = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 20);
      const colony = fauna.spawnHerd('rabbit', 30, 30, t0, true);
      run(fauna, island, t0, 14 * 60);                       // hasta las 10:00
      const alive = colony.filter(a => a.diedAt === null);
      total += alive.length;
      outside += alive.filter(a => a.inside === null && a.outUntil < t0 + 14 * 60).length;
    }
    expect(outside).toBeGreaterThan(0);
    expect(outside / total).toBeLessThan(0.4);
  });

  it('camadas de 2 a 7 crías por tirada (4 o 5 lo más común); con superpoblación o hambre, menos', () => {
    const b = rabbit.breeding as SeasonBreeding;
    const random = new SeededRandom(3);
    const roll = (sat: number, crowded: boolean) => Array.from({ length: 2000 }, () => litterSize(b, sat, crowded, random));
    const fine = roll(0.9, false), bad = roll(0.3, true);
    expect(Math.min(...fine)).toBe(2);
    expect(Math.max(...fine)).toBe(7);
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    expect(mean(fine)).toBeGreaterThan(4.2);
    expect(mean(fine)).toBeLessThan(5);
    expect(Math.min(...bad)).toBe(2);
    expect(mean(bad)).toBeLessThan(mean(fine) - 1.5);
  });

  it('crían en primavera: camadas que nacen dentro de la madriguera y pasan allí sus primeros días', () => {
    const { island, fauna } = setup(24);
    const t0 = hourOf(Season.SPRING, 0, 20);
    const colony = fauna.spawnHerd('rabbit', 48, 48, t0, true);
    run(fauna, island, t0, 25 * DAY);
    const kits = fauna.animals.filter(a => a.species === 1 && a.mother !== null);
    expect(kits.length).toBeGreaterThan(4);
    expect(fauna.news.some(n => n.type === 'born' && n.count >= 2)).toBe(true);
    expect(kits.some(k => colony.some(m => m.id === k.mother))).toBe(true);
  });

  it('ante un susto, unos se quedan quietos y otros corren a la madriguera (y se meten)', () => {
    let froze = 0, total = 0, sheltered = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 23);
      const colony = fauna.spawnHerd('rabbit', 30, 30, t0, true);
      for (const a of colony) {
        a.inside = null;
        a.x += 4;
        a.action = 'idle';
      }
      fauna.sense({ type: 'sandFall', gx: colony[0].x + 1, gy: colony[0].y, strength: 1 }, t0);
      for (const a of colony) if (a.fear >= 0.5) {
        total++;
        if (a.frozenUntil > t0) froze++;
      }
      run(fauna, island, t0, 40);
      sheltered += colony.filter(a => a.inside !== null).length;
    }
    expect(froze / total).toBeGreaterThan(0.35);
    expect(froze / total).toBeLessThan(0.75);
    expect(sheltered).toBeGreaterThan(25);
  });

  it('la Marea derrumba la madriguera por tiradas (cada vez un poco) y entierra a algunos de dentro', () => {
    let collapsed = 0, buried = 0, escaped = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 12);
      const colony = fauna.spawnHerd('rabbit', 30, 30, t0, true);
      const b = fauna.burrows.get(fauna.herds.get(colony[0].herd)!.burrow)!;
      for (const a of colony) {
        a.inside = b.id;
        a.x = b.x;
        a.y = b.y;
      }
      // Cinco pasadas de Marea encima
      for (let n = 0; n < 5 && fauna.burrows.get(b.id); n++) fauna.sense({ type: 'dig', gx: b.x, gy: b.y, strength: 1 }, t0 + n);
      if (!fauna.burrows.get(b.id)) collapsed++;
      buried += colony.filter(a => a.cause === 'buried').length;
      escaped += colony.filter(a => a.diary.some(d => d.key === 'collapse')).length;
    }
    // 1 − 0,85⁵ ≈ 56 % de las veces
    expect(collapsed).toBeGreaterThan(12);
    expect(collapsed).toBeLessThan(32);
    expect(buried).toBeGreaterThan(0);
    expect(escaped).toBeGreaterThan(buried * 0.8);
  });

  it('la arena asentada en la entrada la tapa y, cuanto más y más tiempo, más fácil que se hunda; la cueva nunca', () => {
    let sunk = 0, caveSunk = 0, blocked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 12);
      const rabbits = fauna.spawnHerd('rabbit', 20, 20, t0, true);
      const wolves = fauna.spawnHerd('wolf', 44, 44, t0, true);
      const hole = fauna.burrows.get(fauna.herds.get(rabbits[0].herd)!.burrow)!;
      const cave = fauna.burrows.get(fauna.herds.get(wolves[0].herd)!.burrow)!;
      expect(cave.kind).toBe('cave');
      // Dos niveles de arena encima de cada entrada durante 2 días
      for (const b of [hole, cave]) island.heights.set(`${Math.floor(b.x)},${Math.floor(b.y)}`, 2);
      run(fauna, island, t0, 2 * DAY);
      if (!fauna.burrows.get(hole.id)) sunk++;
      if (!fauna.burrows.get(cave.id)) caveSunk++;
      if (fauna.burrows.get(cave.id)?.blocked || fauna.news.some(n => n.type === 'burrow' && n.what === 'blocked')) blocked++;
    }
    expect(sunk).toBeGreaterThan(10);
    expect(caveSunk).toBe(0);
    expect(blocked).toBeGreaterThan(10);
  });

  it('una madriguera inundada: casi todos salen a tiempo, alguno se ahoga', () => {
    let out = 0, drowned = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 10);
      const colony = fauna.spawnHerd('rabbit', 30, 30, t0, true);
      const b = fauna.burrows.get(fauna.herds.get(colony[0].herd)!.burrow)!;
      for (const a of colony) {
        a.inside = b.id;
        a.x = b.x;
        a.y = b.y;
      }
      island.water.add(`${Math.floor(b.x)},${Math.floor(b.y)}`);
      run(fauna, island, t0, 3 * 60);
      out += colony.filter(a => a.diary.some(d => d.key === 'flood')).length;
      drowned += colony.filter(a => a.cause === 'drowned').length;
    }
    expect(out).toBeGreaterThan(drowned * 3);
    expect(drowned).toBeGreaterThan(0);
  });

  it('la enfermedad se contagia dentro de la colonia, mata a muchos y deja inmunes a los que la pasan', () => {
    let died = 0, immune = 0, sick = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = hourOf(Season.AUTUMN, 2, 10);
      const colony = fauna.spawnHerd('rabbit', 30, 30, t0, true);
      colony[0].sickUntil = t0 + 5 * DAY;
      run(fauna, island, t0, 20 * DAY);
      sick += colony.filter(a => a.immune || a.cause === 'disease').length;
      died += colony.filter(a => a.cause === 'disease').length;
      immune += colony.filter(a => a.immune).length;
    }
    expect(sick).toBeGreaterThan(30);
    expect(died / sick).toBeGreaterThan(0.4);
    expect(died / sick).toBeLessThan(0.8);
    expect(immune).toBeGreaterThan(0);
  });

  it('al hacerse adultos, más machos que hembras dejan la colonia para fundar otra', () => {
    let males = 0, females = 0, maleLeft = 0, femaleLeft = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { island, fauna } = setup(24, 0.8, seed);
      const t0 = hourOf(Season.AUTUMN, 2, 10);
      const colony = fauna.spawnHerd('rabbit', 48, 48, t0, true);
      // Dos jóvenes que cumplen la edad adulta mañana
      const kids = colony.slice(0, 2);
      kids[0] = Object.assign(kids[0], { sex: 'male', bornAt: t0 - (rabbit.adultDays - 0.5) * DAY });
      kids[1] = Object.assign(kids[1], { sex: 'female', bornAt: t0 - (rabbit.adultDays - 0.5) * DAY });
      const herd = kids[0].herd;
      run(fauna, island, t0, DAY + 4 * 60);
      males++;
      females++;
      if (kids[0].herd !== herd) maleLeft++;
      if (kids[1].herd !== herd) femaleLeft++;
    }
    expect(maleLeft / males).toBeGreaterThan(0.4);
    expect(femaleLeft / females).toBeLessThan(0.45);
    expect(maleLeft).toBeGreaterThan(femaleLeft);
  });
});

describe('Fauna: lobos', () => {
  const wolf = SPECIES_DEFS[2];
  const hourOf = (season: SeasonId, day: number, hour: number) => (season * 30 + day) * DAY + hour * 60;

  it('el olfato: oler algo es menos probable cuanto más lejos, y nada más allá de su alcance', () => {
    expect(smellChance(wolf, 1)).toBeGreaterThan(smellChance(wolf, 30));
    expect(smellChance(wolf, 30)).toBeGreaterThan(smellChance(wolf, 60));
    expect(smellChance(wolf, wolf.senses.smell * 32)).toBe(0);
    expect(smellChance(deer, 20)).toBe(0);
  });

  it('cazar sale mal casi siempre con un ciervo adulto; mejor con crías, débiles, en manada y con nieve', () => {
    const { fauna } = setup(16);
    const t0 = hourOf(Season.SUMMER, 2, 12);
    const herd = fauna.spawnHerd('deer', 30, 30, t0);
    const adult = herd.find(a => a.mother === null)!, calf = herd.find(a => a.mother !== null)!;
    const alone = catchChance(wolf, adult, deer, 0, false, t0);
    expect(alone).toBeLessThan(0.2);
    expect(catchChance(wolf, calf, deer, 0, false, t0)).toBeGreaterThan(alone * 2);
    expect(catchChance(wolf, adult, deer, 3, false, t0)).toBeGreaterThan(alone);
    expect(catchChance(wolf, adult, deer, 3, true, t0)).toBeGreaterThan(catchChance(wolf, adult, deer, 3, false, t0));
  });

  it('con hambre cazan ciervos y conejos (más los débiles), se los comen y el resto lo cuenta la crónica', () => {
    let kills = 0, eaten = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { island, fauna } = setup(32, 0.8, seed);
      const t0 = hourOf(Season.SUMMER, 2, 18);
      fauna.spawnHerd('deer', 40, 40, t0);
      fauna.spawnHerd('rabbit', 70, 40, t0, true);
      const pack = fauna.spawnHerd('wolf', 60, 70, t0, true);
      for (const w of pack) w.satiety = 0.3;
      // Cadáveres de presas de los que se ha comido algo (se miran cada pocas horas: los restos se acaban yendo)
      const bitten = new Set<number>();
      for (let h = 0; h < 4 * 24; h += 3) {
        run(fauna, island, t0 + h * 60, 3 * 60);
        for (const c of fauna.corpses) if (c.cause === 'predation' && c.meat < c.meatFull) bitten.add(c.id);
      }
      kills += fauna.news.filter(n => n.type === 'killed').length;
      eaten += bitten.size;
    }
    expect(kills).toBeGreaterThan(2);
    expect(eaten).toBeGreaterThan(0);
  });

  it('huelen la carroña y van a comérsela', () => {
    const { island, fauna } = setup(24);
    const t0 = hourOf(Season.SUMMER, 2, 18);
    const deers = fauna.spawnHerd('deer', 30, 30, t0);
    const pack = fauna.spawnHerd('wolf', 60, 60, t0, true);
    for (const w of pack) w.satiety = 0.3;
    // Un ciervo muere de viejo: queda su cuerpo
    for (const d of deers) d.health = -1;
    run(fauna, island, t0, 1);
    const corpse = fauna.corpses[0];
    const before = corpse.meat;
    for (const d of fauna.animals.filter(a => a.species === 0)) d.x = d.y = 2;
    run(fauna, island, t0 + 1, 12 * 60);
    expect(corpse.meat).toBeLessThan(before);
  });

  it('solo cría la pareja dominante, en invierno; los cachorros nacen en la guarida en primavera', () => {
    const { island, fauna } = setup(24);
    const t0 = hourOf(Season.WINTER, 0, 12);
    const pack = fauna.spawnHerd('wolf', 48, 48, t0, true);
    for (const w of pack) w.satiety = 1;
    run(fauna, island, t0, 30 * DAY);
    const pregnant = pack.filter(w => w.dueAt !== null);
    expect(pregnant.length).toBeLessThanOrEqual(1);
    const leader = leaderOf(pack, wolf, t0 + 30 * DAY);
    if (pregnant.length) expect(pregnant[0]).toBe(leader);
  });

  it('aúllan al anochecer (casi siempre) y las presas de toda la isla se sobresaltan', () => {
    const { island, fauna } = setup(24);
    const t0 = hourOf(Season.SUMMER, 2, 12);
    const deers = fauna.spawnHerd('deer', 20, 20, t0);
    fauna.spawnHerd('wolf', 70, 70, t0, true);
    // Anocheceres con aullidos (si la manada se divide, cada una aúlla por su cuenta: cuenta una vez por noche)
    let howlNights = 0, seen = 0;
    run(fauna, island, t0, 6 * DAY, () => {
      const n = fauna.news.filter(x => x.type === 'howl').length;
      if (n > seen) howlNights++;
      seen = n;
    });
    // 60 % cada anochecer: en seis días, casi seguro que aúllan alguna vez (y no todas)
    expect(howlNights).toBeGreaterThanOrEqual(1);
    expect(howlNights).toBeLessThanOrEqual(6);
    // Con la costumbre, a los ciervos que llevan días oyéndolos ya casi no les asusta
    const used = deers.find(d => d.diedAt === null);
    if (used) {
      // (cuántas veces aullaron va por tiradas: se completa con unos aullidos más, sin daño, para la costumbre)
      for (let n = 1; n <= 4; n++) fauna.sense({ type: 'howl', gx: 90, gy: 90, strength: 1 }, t0 + 6 * DAY + n * 360);
      used.fear = 0;
      fauna.sense({ type: 'howl', gx: 90, gy: 90, strength: 1 }, t0 + 6 * DAY + 5 * 360);
      expect(used.fear).toBeLessThan(0.2);
    }
    // Un aullido para una manada que nunca lo ha oído: se sobresaltan en toda la isla (miedo y su '!'); los lobos, no
    const fresh = setup(24);
    const herd = fresh.fauna.spawnHerd('deer', 10, 10, t0);
    const pack = fresh.fauna.spawnHerd('wolf', 80, 80, t0, true);
    fresh.fauna.sense({ type: 'howl', gx: 80, gy: 80, strength: 1 }, t0);
    expect(herd.every(d => d.fear > 0.2 && d.signal?.kind === 'alarm')).toBe(true);
    expect(pack.every(w => w.signal === null)).toBe(true);
  });
});

describe('Fauna: crías, agua y llegadas (comunes a todas las especies)', () => {
  const hourOf = (season: SeasonId, day: number, hour: number) => (season * 30 + day) * DAY + hour * 60;

  it('las crías de madriguera con madre que entra y sale casi siempre salen adelante (no mueren por la hora)', () => {
    let born = 0, orphaned = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { island, fauna } = setup(24, 0.8, seed);
      const t0 = hourOf(Season.SPRING, 0, 20);
      fauna.spawnHerd('rabbit', 48, 48, t0, true);
      // Huérfanas con la madre viva (las de una madre muerta son huérfanas de verdad): se miran cada día
      const counted = new Set<number>();
      run(fauna, island, t0, 30 * DAY, () => {
        for (const k of fauna.corpses) {
          if (k.cause !== 'orphaned' || counted.has(k.id)) continue;
          counted.add(k.id);
          if (fauna.animals.some(m => m.id === k.mother)) orphaned++;
        }
      });
      born += fauna.news.filter(n => n.type === 'born').reduce((s, n) => s + (n.type === 'born' ? n.count : 0), 0);
    }
    expect(born).toBeGreaterThan(10);
    expect(orphaned / born).toBeLessThan(0.2);
  });

  it('sin agua cerca, la buscan cada vez más lejos y la encuentran antes de morir de sed (y la recuerdan)', () => {
    let alive = 0, total = 0, remembered = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const { island, fauna } = setup(24, 0.8, seed);
      island.water.clear();
      island.pond(84, 84);
      const t0 = at(Season.SPRING);
      const herd = fauna.spawnHerd('deer', 10, 10, t0);
      for (const a of herd) a.hydration = 0.3;
      run(fauna, island, t0, 3 * DAY);
      total += herd.length;
      alive += herd.filter(a => a.diedAt === null && a.hydration > 0.3).length;
      if (fauna.herds.get(herd[0].herd)?.water.length) remembered++;
    }
    expect(alive / total).toBeGreaterThan(0.6);
    expect(remembered).toBeGreaterThan(0);
  });

  it('una manada muerta de hambre suele irse de la isla antes de morir, pero no siempre', () => {
    let left = 0, starved = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      island.chunks = 4;
      island.coast = { x: 2.5, y: 2.5 };
      const t0 = at(Season.SUMMER);
      const pack = fauna.spawnHerd('wolf', 40, 40, t0, true);
      for (const w of pack) w.satiety = 0.05;
      run(fauna, island, t0, 12 * DAY);
      if (fauna.news.some(n => n.type === 'left')) left++;
      if (pack.some(w => w.cause === 'starvation')) starved++;
    }
    // La mitad o más (además, sin presas los jóvenes se van antes por su cuenta: la manada que queda es más pequeña)
    expect(left).toBeGreaterThanOrEqual(10);
    expect(starved).toBeGreaterThan(0);
  });

  it('a una isla vacía llegan grupos por la orilla: primero los que no viven solo de carne, nunca más de lo que cabe', () => {
    const { island, fauna } = setup(24, 0.8, 3);
    island.chunks = 4;
    island.coast = { x: 40.5, y: 40.5 };
    const t0 = at(Season.SPRING);
    const arrivals: number[] = [];
    run(fauna, island, t0, 60 * DAY, () => {
      for (const n of fauna.news.splice(0)) if (n.type === 'arrived') arrivals.push(n.species);
    });
    expect(arrivals.length).toBeGreaterThan(0);
    // Los primeros no viven solo de carne (herbívoros, o quien recolecta: humanos, cuervos): sin presas no hay de qué
    expect(SPECIES_DEFS[arrivals[0]].diets.includes('carnivore')).toBe(false);
    const groups = new Set(fauna.animals.map(a => a.herd)).size;
    expect(groups).toBeLessThanOrEqual(12);   // tope de 8 grupos (más los jóvenes que se van a fundar el suyo)
  });
});

describe('Fauna: topes y llegadas por especie', () => {
  const [deerS, rabbitS, wolfS] = SPECIES_DEFS;
  const ctx = { population: 0, capacity: 50, groups: 0, groupSize: 5, cap: 4, absentDays: Infinity, carrion: false };

  it('en un 2×2 caben de 3 a 4 colonias de conejos, de 1 a 5 manadas de ciervos y de 1 a 2 de lobos', () => {
    const random = new SeededRandom(5);
    const roll = (s: typeof deerS) => Array.from({ length: 500 }, () => speciesCap(s, 4, random));
    for (const [s, lo, hi] of [[rabbitS, 3, 4], [deerS, 1, 5], [wolfS, 1, 2]] as const) {
      const caps = roll(s);
      expect(Math.min(...caps)).toBe(lo);
      expect(Math.max(...caps)).toBe(hi);
    }
  });

  it('una especie que desaparece no vuelve hasta pasados 60 días; el lobo solo llega sin lobos y con carroña', () => {
    expect(arrivalChance(deerS, { ...ctx, absentDays: 30 })).toBe(0);
    expect(arrivalChance(deerS, { ...ctx, absentDays: 61 })).toBeGreaterThan(0);
    expect(arrivalChance(deerS, { ...ctx, groups: 4 })).toBe(0);                    // en su tope
    expect(arrivalChance(wolfS, { ...ctx, capacity: 5 })).toBe(0);                  // sin carroña
    expect(arrivalChance(wolfS, { ...ctx, capacity: 5, carrion: true })).toBeGreaterThan(0);
    expect(arrivalChance(wolfS, { ...ctx, capacity: 9, carrion: true, population: 2, groups: 0 })).toBe(0);  // ya hay lobos
  });

  it('una especie de más (por encima de su tope) puede perder un grupo; más cuanto más se pasa', () => {
    expect(crowdLeaveChance(rabbitS, 4, 4)).toBe(0);
    expect(crowdLeaveChance(rabbitS, 5, 4)).toBeGreaterThan(0);
    expect(crowdLeaveChance(rabbitS, 6, 4)).toBeGreaterThan(crowdLeaveChance(rabbitS, 5, 4));
    // Solo el depredador se va por hambre
    expect(leaveChance(deerS, 0, 0.3)).toBe(0);
    expect(leaveChance(wolfS, 0, 0.3)).toBeGreaterThan(0);
  });
});

describe('Fauna: llegada natural del lobo', () => {
  it('de fuera llega una pareja con 1 a 3 jóvenes, atraída por la carroña, no una manada entera', () => {
    const sizes: number[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const { island, fauna } = setup(24, 0.8, seed);
      island.chunks = 4;
      island.coast = { x: 40.5, y: 40.5 };
      const t0 = at(Season.SPRING);
      for (let h = 0; h < 3; h++) fauna.spawnHerd('deer', 30 + h * 15, 60, t0);
      const die = (fauna as unknown as { die(a: unknown, c: string, n: number): void }).die.bind(fauna);
      let arrived = 0;
      run(fauna, island, t0, 45 * DAY, day => {
        // Siempre hay algún cadáver con carne que oler
        const old = fauna.animals.find(a => a.species === 0);
        if (old && day % 3 === 0) die(old, 'oldAge', t0 + day * DAY);
        for (const n of fauna.news.splice(0)) if (n.type === 'arrived' && n.species === 2) arrived = n.count;
      });
      if (arrived) sizes.push(arrived);
    }
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every(n => n >= 3 && n <= 5)).toBe(true);
  }, 60000);
});

describe('Fauna: cuervos, humanos y goblins (comportamientos comunes con sus parámetros)', () => {
  const crowS = SPECIES_DEFS.find(s => s.key === 'crow')!;
  const humanS = SPECIES_DEFS.find(s => s.key === 'human')!;
  const goblinS = SPECIES_DEFS.find(s => s.key === 'goblin')!;
  const wolfS2 = SPECIES_DEFS.find(s => s.key === 'wolf')!;
  type Internals = {
    flying: boolean;
    canStep(x: number, y: number, nx: number, ny: number): boolean;
    strike(a: unknown, s: unknown, prey: unknown, now: number, ambush: boolean): void;
    die(a: unknown, c: string, n: number): void;
  };

  it('volando, el agua no corta el paso (andando, sí)', () => {
    const { island, fauna } = setup(16);
    for (let y = 0; y < 64; y++) island.water.add(`20,${y}`);
    const f = fauna as unknown as Internals;
    f.flying = false;
    expect(f.canStep(19.5, 10.5, 20.5, 10.5)).toBe(false);
    f.flying = true;
    expect(f.canStep(19.5, 10.5, 20.5, 10.5)).toBe(true);
    expect(crowS.locomotion).toBe('fly');
  });

  it('una banda humana que plantan cara puede matar al lobo que ataca (a veces, no siempre); un ciervo, nunca', () => {
    const now = at(Season.SUMMER);
    let tries = 0, killed = 0, deerKilled = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const { fauna } = setup(24, 0.8, seed);
      const f = fauna as unknown as Internals;
      const band = fauna.spawnHerd('human', 40, 40, now, false, [{ sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }]);
      const herd = fauna.spawnHerd('deer', 60, 60, now, false, [{ sex: 'female', age: 'adult' }]);
      for (let i = 0; i < 50; i++) {
        const [w] = fauna.spawnHerd('wolf', 41, 41, now, false, [{ sex: 'male', age: 'adult' }]);
        f.strike(w, wolfS2, band[0], now, false);
        tries++;
        if (fauna.corpses.some(c => c.id === w.id && c.cause === 'injury')) killed++;
        if (band[0].diedAt !== null) break;
        const [w2] = fauna.spawnHerd('wolf', 61, 61, now, false, [{ sex: 'male', age: 'adult' }]);
        if (herd[0].diedAt === null) f.strike(w2, wolfS2, herd[0], now, false);
        if (fauna.corpses.some(c => c.id === w2.id && c.cause === 'injury' && c.diary.some(d => d.key === 'kicked') === false)) deerKilled++;
      }
    }
    expect(humanS.defend?.kill).toBeGreaterThan(0);
    expect(killed / tries).toBeGreaterThan(0.05);
    expect(killed / tries).toBeLessThan(0.7);
    expect(deerKilled).toBe(0);
  });

  it('el sol quema a un goblin que se queda fuera de día; de noche no', () => {
    const { island, fauna } = setup(16);
    const noon = at(Season.SUMMER) + 3 * 60;          // 12:00
    const out = fauna.spawnHerd('goblin', 30, 30, noon, false, [{ sex: 'male', age: 'adult' }]);
    run(fauna, island, noon, 3 * 60);
    expect(out[0].health).toBeLessThan(1);
    expect(out[0].diary.some(d => d.key === 'sunburnt')).toBe(true);
    const night = at(Season.SUMMER, 3) + 13 * 60;      // 22:00
    const { island: i2, fauna: f2 } = setup(16);
    const [g] = f2.spawnHerd('goblin', 30, 30, night, false, [{ sex: 'male', age: 'adult' }]);
    run(f2, i2, night, 3 * 60);
    expect(g.diary.some(d => d.key === 'sunburnt')).toBe(false);
    expect(goblinS.sunHurt).toBeGreaterThan(0);
  });
});

describe('Fauna: los goblins nacen con la Tierra Quemada y la mantienen viva', () => {
  /** Tierra Quemada de mentira: una zona de 3 × 3 tiles que apunta si está viva */
  class FakeBurnt implements BurntLand {
    region: BurntRegion = { tiles: Array.from({ length: 9 }, (_, k) => ({ gi: 4 + (k % 3), gj: 4 + Math.floor(k / 3) })) };
    alive: boolean | null = null;
    regions(): BurntRegion[] { return [this.region]; }
    setLife(_r: BurntRegion, alive: boolean): void { this.alive = alive; }
  }

  it('sus nidos aparecen de 5 a 7 días después; mientras quede un goblin vivo la zona vive, y sin ninguno remite', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const land = new FakeBurnt();
      const born = new BurntBorn(land, fauna, new SeededRandom(seed));
      const t0 = at(Season.SPRING);
      const goblins = () => fauna.animals.filter(a => a.species === SPECIES_DEFS.find(s => s.key === 'goblin')!.id);
      let bornAt = -1;
      for (let h = 0; h < 8 * 24; h++) {
        const now = t0 + h * 60;
        const out = born.hour(now);
        if (out.some(o => o.nests > 0) && bornAt < 0) bornAt = h / 24;
      }
      expect(bornAt).toBeGreaterThanOrEqual(5);
      expect(bornAt).toBeLessThanOrEqual(7.05);
      expect(goblins().length).toBeGreaterThanOrEqual(1);
      expect(goblins().length).toBeLessThanOrEqual(3);
      expect(land.alive).toBe(true);
      // Mueren todos: la zona deja de vivir (remite)
      const die = (fauna as unknown as { die(a: unknown, c: string, n: number): void }).die.bind(fauna);
      for (const g of goblins()) die(g, 'injury', t0 + 8 * DAY);
      born.hour(t0 + 8 * DAY + 60);
      expect(land.alive).toBe(false);
      void island;
    }
  });
});

describe('Fauna: carroña, huesos, nidos y velocidad (cambios de equilibrio)', () => {
  const byKey = (k: string) => SPECIES_DEFS.find(s => s.key === k)!;
  type Internals = { die(a: unknown, c: string, n: number): void; feedOn(a: unknown, s: unknown, n: number): void };
  const c0x = (c: { x: number }) => c.x + 0.5;

  it('lobos, humanos y goblins dejan los restos pegados a los huesos; el cuervo los limpia', () => {
    const now = at(Season.SUMMER);
    const { fauna } = setup(16);
    const f = fauna as unknown as Internals;
    const [deerA] = fauna.spawnHerd('deer', 30, 30, now, false, [{ sex: 'female', age: 'adult' }]);
    f.die(deerA, 'predation', now);
    const corpse = fauna.corpses.find(c => c.id === deerA.id)!;
    const full = corpse.meat;
    // Un lobo comiendo hasta que ya no le compensa
    const [w] = fauna.spawnHerd('wolf', 30, 30, now, false, [{ sex: 'male', age: 'adult' }]);
    w.x = c0x(corpse); w.y = corpse.y;
    for (let m = 0; m < 2000; m++) {
      w.satiety = 0;
      w.feeding = corpse.id;
      f.feedOn(w, byKey('wolf'), now + m);
      if (w.feeding === null) break;
    }
    expect(corpse.meat).toBeGreaterThan(full * 0.1);
    expect(corpse.meat).toBeLessThan(full * 0.2);
    // El cuervo sigue picando hasta dejarlo limpio
    const [c] = fauna.spawnHerd('crow', 30, 30, now, false, [{ sex: 'male', age: 'adult' }]);
    c.x = c0x(corpse); c.y = corpse.y;
    for (let m = 0; m < 4000 && corpse.meat > 0.006; m++) {
      c.satiety = 0;
      c.feeding = corpse.id;
      f.feedOn(c, byKey('crow'), now + m);
    }
    expect(corpse.meat).toBeLessThan(0.01);
  });

  it('la carroña atrae a los cuervos (más llegadas), pero llegan también sin ella; en un 2×2 cabe al menos un grupo', () => {
    const crowS = byKey('crow');
    const ctx = { population: 0, capacity: 50, groups: 0, groupSize: 4, cap: 2, absentDays: 999, carrion: false };
    const without = arrivalChance(crowS, ctx), withC = arrivalChance(crowS, { ...ctx, carrion: true });
    expect(without).toBeGreaterThan(0);
    expect(withC).toBeCloseTo(Math.min(1, without * 2));
    let min = Infinity;
    for (let i = 0; i < 200; i++) min = Math.min(min, speciesCap(crowS, 4, new SeededRandom(i)));
    expect(min).toBeGreaterThanOrEqual(1);
  });

  it('el goblin corre más que el conejo y el lobo; solo el cuervo en vuelo le gana', () => {
    const g = byKey('goblin').speed.run;
    for (const k of ['deer', 'rabbit', 'wolf', 'human']) expect(g).toBeGreaterThan(byKey(k).speed.run);
    expect(byKey('crow').speed.fly!).toBeGreaterThan(g);
    expect(byKey('goblin').range.roam).toBeGreaterThanOrEqual(4);
  });

  it('una presa dormida a la intemperie es mucho más fácil de cazar (un goblin bajo un árbol de día)', () => {
    const now = at(Season.SUMMER);
    const { fauna } = setup(16);
    const [g] = fauna.spawnHerd('goblin', 30, 30, now, false, [{ sex: 'male', age: 'adult' }]);
    const awake = catchChance(byKey('human'), g, byKey('goblin'), 0, false, now);
    g.action = 'sleep';
    const asleep = catchChance(byKey('human'), g, byKey('goblin'), 0, false, now);
    expect(asleep).toBeGreaterThan(awake + 0.3);
  });

  it('nunca hay más de 2 nidos de goblins en la isla, por grandes que sean las zonas', () => {
    class TwoZones implements BurntLand {
      big: BurntRegion = { tiles: Array.from({ length: 40 }, (_, k) => ({ gi: 1 + (k % 8), gj: 1 + Math.floor(k / 8) })) };
      other: BurntRegion = { tiles: Array.from({ length: 20 }, (_, k) => ({ gi: 12 + (k % 4), gj: 10 + Math.floor(k / 4) })) };
      regions(): BurntRegion[] { return [this.big, this.other]; }
      setLife(): void {}
    }
    const { fauna } = setup(20);
    const born = new BurntBorn(new TwoZones(), fauna, new SeededRandom(5));
    const t0 = at(Season.SPRING);
    let nests = 0;
    for (let h = 0; h < 8 * 24; h++) for (const o of born.hour(t0 + h * 60)) nests += o.nests;
    const goblinId = byKey('goblin').id;
    const herds = new Set(fauna.animals.filter(a => a.species === goblinId).map(a => a.herd));
    expect(nests).toBe(2);
    expect(herds.size).toBe(2);
    expect(fauna.nestsFull(byKey('goblin'))).toBe(true);
    // Una zona de 40 tiles: más goblins por nido (hasta 5)
    for (const h of herds) expect(fauna.members(h).length).toBeLessThanOrEqual(5);
  });
});

describe('Fauna: el cuervo vive de restos, carroña y fruta', () => {
  it('en un 2×2 con ciervos y conejos (sin cadáveres ni fruta) ya caben cuervos: le cuentan los restos de las presas de otros', () => {
    const now = at(Season.SPRING);
    const { island, fauna } = setup(16, 0);       // sin hierba: la fruta no cuenta aquí
    island.chunks = 4;
    fauna.spawnHerd('deer', 20, 20, now); fauna.spawnHerd('deer', 40, 40, now);
    for (const [x, y] of [[10, 50], [30, 12], [50, 25]]) fauna.spawnHerd('rabbit', x, y, now, true);
    const crow = SPECIES_DEFS.find(s => s.key === 'crow')!;
    const cap = fauna.stats().find(x => x.species === crow.id)!.capacity;
    // Cabe al menos un grupo pequeño: una pareja con su cría
    expect(cap).toBeGreaterThanOrEqual(3);
    // Con un cadáver, más
    const [d] = fauna.spawnHerd('deer', 30, 30, now, false, [{ sex: 'female', age: 'adult' }]);
    (fauna as unknown as { die(a: unknown, c: string, n: number): void }).die(d, 'oldAge', now);
    fauna.minute(toGameTime(now + 60 - (now % 60)));
    expect(fauna.stats().find(x => x.species === crow.id)!.capacity).toBeGreaterThan(cap);
  });
});

describe('Fauna: cuerpo a cuerpo', () => {
  it('al alcanzar a la presa luchan encarados unos minutos (espada sobre los dos) y después se resuelve: cae, escapa herida o planta cara', () => {
    const outcomes = { killed: 0, escaped: 0, other: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const now = at(Season.SUMMER);
      const [w] = fauna.spawnHerd('wolf', 30, 30, now, false, [{ sex: 'male', age: 'adult' }]);
      const [d] = fauna.spawnHerd('deer', 31, 30, now, false, [{ sex: 'female', age: 'adult' }]);
      w.hunt = { target: d.id, phase: 'chase', since: now };
      (fauna as unknown as { startFight(a: unknown, p: unknown, n: number, amb: boolean): void }).startFight(w, d, now, false);
      expect(w.action).toBe('fight');
      expect(d.action).toBe('fight');
      expect(w.signal?.kind).toBe('fight');
      expect(d.signal?.kind).toBe('fight');
      // Dura de 3 a 6 minutos: a los 2 siguen luchando, a los 8 ya se ha resuelto
      run(fauna, island, now, 2);
      expect(d.diedAt === null ? d.action : 'fight').toBe('fight');
      run(fauna, island, now + 2, 6);
      expect(w.fight).toBeNull();
      if (d.diedAt !== null) outcomes.killed++;
      else if (d.diary.some(x => x.key === 'escaped')) {
        outcomes.escaped++;
        expect(d.health).toBeLessThan(1);
        expect(d.signal?.kind).toBe('flee');
      } else outcomes.other++;
    }
    expect(outcomes.killed).toBeGreaterThan(0);
    expect(outcomes.escaped + outcomes.other).toBeGreaterThan(0);
  });
});

describe('Fauna: cadáveres', () => {
  it('se mide cuánto se han comido: fresco, comido, huesos (solo cuervos) y limpio', () => {
    const now = at(Season.SUMMER);
    const { fauna } = setup(16);
    const [d] = fauna.spawnHerd('deer', 30, 30, now, false, [{ sex: 'female', age: 'adult' }]);
    (fauna as unknown as { die(a: unknown, c: string, n: number): void }).die(d, 'predation', now);
    expect(carcassState(d)).toBe('fresh');
    expect(eatenOf(d)).toBe(0);
    d.meat = d.meatFull * 0.5;
    expect(carcassState(d)).toBe('eaten');
    expect(eatenOf(d)).toBeCloseTo(0.5);
    d.meat = d.meatFull * 0.1;
    expect(carcassState(d)).toBe('bones');
    d.meat = 0;
    expect(carcassState(d)).toBe('clean');
  });
});

describe('Fauna: la manada de lobos comparte y alimenta a sus jóvenes', () => {
  it('un adulto bien comido lleva comida al joven hambriento que aún no caza', () => {
    let fed = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      const t0 = at(Season.SUMMER) + 3 * 60;
      const pack = fauna.spawnHerd('wolf', 30, 30, t0, false, [{ sex: 'female', age: 'adult' }, { sex: 'male', age: 'young' }]);
      const [adult, young] = pack;
      young.bornAt = t0 - 20 * DAY;      // 20 días: ya no mama y aún no caza
      adult.satiety = 1;
      young.satiety = 0.2;
      // Sin comida a mano (sin hierba ni presas): si el joven sube de saciedad es porque se la han traído
      let max = young.satiety;
      for (let m = 0; m < 6 * 60; m += 10) {
        run(fauna, island, t0 + m, 10);
        max = Math.max(max, young.satiety);
      }
      if (max > 0.35) fed++;
    }
    expect(fed).toBeGreaterThanOrEqual(3);
  });

  it('cuando uno caza, los suyos acuden a comer de la presa', () => {
    const { island, fauna } = setup(16);
    const t0 = at(Season.SUMMER) + 3 * 60;
    const pack = fauna.spawnHerd('wolf', 30, 30, t0, false, [{ sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }]);
    for (const w of pack) w.satiety = 0.6;
    const [d] = fauna.spawnHerd('deer', 31, 30, t0, false, [{ sex: 'female', age: 'adult' }]);
    pack[0].hunt = { target: d.id, phase: 'chase', since: t0 };
    // Sin resistencia: la presa cae a la primera
    d.health = 0.01;
    (fauna as unknown as { strike(a: unknown, s: unknown, p: unknown, n: number, amb: boolean): void }).strike(pack[0], SPECIES_DEFS.find(s => s.key === 'wolf'), d, t0, true);
    if (d.diedAt === null) return;     // la tirada de caza puede fallar: entonces no hay nada que comprobar
    expect(fauna.herds.get(pack[0].herd)!.feast).toBe(d.id);
    run(fauna, island, t0, 120);
    expect(pack[1].satiety).toBeGreaterThan(0.6);
  });
});

describe('Fauna: temperatura', () => {
  const byKey = (k: string) => SPECIES_DEFS.find(s => s.key === k)!;

  it('con un frío fuera de su franja acumulan frío y, sin abrigo, acaban con hipotermia (pierden vida)', () => {
    const { island, fauna } = setup(16);
    island.temp = -0.3;
    const t0 = at(Season.WINTER) + 3 * 60;
    const [h] = fauna.spawnHerd('human', 30, 30, t0, false, [{ sex: 'male', age: 'adult' }]);
    run(fauna, island, t0, 12 * 60);
    expect(h.cold).toBeGreaterThan(0);
    expect(h.health).toBeLessThan(1);
    // A gusto se recupera
    island.temp = 0.5;
    const cold = h.cold;
    run(fauna, island, t0 + 12 * 60, 3 * 60);
    expect(h.cold).toBeLessThan(cold);
  });

  it('el lobo aguanta el frío mucho mejor que el humano', () => {
    expect(byKey('wolf').comfort[0]).toBeLessThan(byKey('human').comfort[0]);
    expect(byKey('goblin').comfort[1]).toBeGreaterThan(5);     // el calor no le afecta
  });

  it('los goblins hibernan en invierno: en su nido, dormidos, sin salir aunque tengan hambre, y apenas gastan', () => {
    const { island, fauna } = setup(16);
    island.rock = new Set();
    // Suelo calcinado para su nido
    (island as unknown as { materialAt: (x: number, y: number) => number }).materialAt = () => Material.CHARRED;
    const t0 = at(Season.WINTER) + 3 * 60;
    fauna.conditions = { rain: 0, storm: false, snow: false, cold: true, hot: false, drought: false };
    const g = fauna.spawnHerd('goblin', 30, 30, t0, true, [{ sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' }]);
    for (const x of g) x.satiety = 0.3;
    // El juego pone las condiciones cada minuto; en la prueba, invierno todo el rato
    for (let m = t0; m < t0 + 2 * DAY; m++) {
      fauna.conditions = { rain: 0, storm: false, snow: false, cold: true, hot: false, drought: false };
      fauna.minute(toGameTime(m));
    }
    expect(g.every(x => x.inside !== null)).toBe(true);
    expect(g.every(x => x.satiety > 0.2)).toBe(true);
  });
});

describe('Fauna: manada según las presas y ciervas que llegan preñadas', () => {
  it('con pocas presas, una manada grande de lobos pierde jóvenes que se van (no se queda toda a cazar)', () => {
    let shrank = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const { island, fauna } = setup(16, 0.8, seed);
      island.chunks = 4;
      island.coast = { x: 40.5, y: 40.5 };
      const t0 = at(Season.SUMMER, 2);
      fauna.spawnHerd('deer', 20, 20, t0, false, [{ sex: 'female', age: 'adult' }]);
      const pack = fauna.spawnHerd('wolf', 40, 40, t0, true, [
        { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }, { sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' },
      ]);
      for (const w of pack) w.satiety = 1;
      run(fauna, island, t0, 4 * DAY);
      if (fauna.members(pack[0].herd).length < 5) shrank++;
    }
    expect(shrank).toBeGreaterThanOrEqual(3);
  });

  it('las ciervas que llegan en primavera suelen venir preñadas y paren ese mismo año', () => {
    let pregnant = 0, total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { fauna } = setup(16, 0.8, seed);
      const herd = fauna.spawnHerd('deer', 30, 30, at(Season.SPRING, 2), false, [
        { sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' },
      ], true);
      for (const d of herd) if (d.sex === 'female') { total++; if (d.dueAt !== null) pregnant++; }
    }
    expect(pregnant / total).toBeGreaterThan(0.3);
    expect(pregnant / total).toBeLessThan(0.9);
    // En verano (ya pasaron los partos) no
    const { fauna } = setup(16);
    const summer = fauna.spawnHerd('deer', 30, 30, at(Season.SUMMER, 2), false, undefined, true);
    expect(summer.every(d => d.dueAt === null)).toBe(true);
  });
});
