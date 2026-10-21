import { FaunaSystem } from './fauna-system';
import { FaunaWorld, Meal } from '../../domain/ports/fauna-world.port';
import { Diet } from '../../domain/models/plant.model';
import { SeasonId, Season, toGameTime, DAYS_PER_YEAR } from '../../domain/models/time.model';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { PLANT_DEFS } from '../../config/plants.config';
import { SPECIES_DEFS } from '../../config/species.config';
import { lifeStage } from './needs';
import { tryConceive } from './breeding';
import { animalView } from './animal-view';
import { leaderOf } from './herds';
import { RUN_STOP } from '../../config/fauna.config';

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
  height(): number { return 0; }
  foodAt(gx: number, gy: number, diets: readonly Diet[], avoid: ReadonlySet<number>): number {
    const t = this.t(gx, gy);
    if (t < 0) return 0;
    let f = Math.max(0, this.grass[t] - 0.02) * GRASS.food!.nutrition;
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
    if (this.grass[t] <= 0.025) return null;
    const b = Math.min(this.grass[t] - 0.02, want / GRASS.food!.nutrition);
    this.grass[t] -= b;
    return { food: b * GRASS.food!.nutrition, plant: GRASS.id, fruit: false };
  }
  nearestWater(gx: number, gy: number, max: number) {
    let best: { x: number; y: number; distance: number } | null = null;
    for (const k of this.water) {
      const [x, y] = k.split(',').map(Number);
      const d = Math.hypot(x - gx, y - gy);
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
  dropSeed(): void {}
  fertilize(): void {}
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
    // A las 3:00, todos juntos en su sitio
    run(fauna, island, m, 9 * 60);
    const cx = herd.reduce((s, a) => s + a.x, 0) / herd.length, cy = herd.reduce((s, a) => s + a.y, 0) / herd.length;
    for (const a of herd) expect(Math.hypot(a.x - cx, a.y - cy)).toBeLessThan(deer.herd.cohesion * 2);
    expect(herd.some(a => a.diary.some(d => d.key === 'explore'))).toBe(true);
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
