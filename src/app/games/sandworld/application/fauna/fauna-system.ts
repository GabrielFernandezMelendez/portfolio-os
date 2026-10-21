import { Animal, AnimalOrder, AnimalSignal, Burrow, DeathCause, Herd, Sex } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { GameTime, SeasonId, CALENDAR } from '../../domain/models/time.model';
import { FaunaWorld } from '../../domain/ports/fauna-world.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { WORLD } from '../../domain/models/world.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { SPECIES_BY_KEY, SPECIES_DEFS } from '../../config/species.config';
import {
  BURROW_ENTER, CAPACITY_DAYS, COLLAPSE, CORPSE_FERTILITY, FREEZE_MINUTES, INSIDE_HUNGRY, CROWDED, DRINK_RANGE, EAT_BELOW, FIRE_HEALTH_PER_MINUTE,
  FOOD_HERE, FORAGE_RADIUS, FORAGE_SAMPLES, FULL, GATHER_MARGIN, JOIN_RANGE, LOST_NIGHT, MAX_STEP, PATH_FROM, PATH_NODES,
  REJECT_HEALTH, RETURN_CHANCE, ROAM_CHANCE, ROAM_HOURS, RUN_MIN, RUN_STOP, RUN_TIRE_PER_MINUTE, SEED_GUT_HOURS,
  SLEEP_BELOW, SOIL_DAMAGE, SOIL_DAMAGE_FROM, STUCK_MINUTES, THINK_MINUTES, THIRST_BELOW, TOXIC_HEALTH, TRAMPLE,
  WELCOME_CHANCE,
} from '../../config/fauna.config';
import { NeedMods, ageDays, appetite, lifeStage, passTime, updateHappiness } from './needs';
import { Stimulus } from '../../domain/models/stimulus.model';
import {
  ALARM_RANGE, ALARM_SHARE, BURY_HEALTH, CURIOUS_BELOW, FEAR_DECAY, FLEE_FEAR, LIGHTNING_HEALTH, RELAXED, STARTLE_FEAR, TEMPERAMENTS,
} from '../../config/temperament.config';
import { addZone, fearOf, habitLevel, habituate, inZone } from './reactions';
import { centre, leaderOf, splitOff } from './herds';
import { litterSize, tryConceive, tryConceiveSeason } from './breeding';
import { Burrows, BurrowHit } from './burrows';
import { infect, outbreak, recover, spread } from './disease';
import { nameFor, write } from './diary';
import { findPath } from './pathfinding';

const DAY = CALENDAR.MINUTES_PER_DAY;
const G = WORLD.CELLS_PER_TILE;
/** Celdas por lado de una isla: las distancias de cada especie se dan en islas */
const ISLAND = WORLD.CELLS;

/** Lo que pasa en la fauna y se cuenta en la crónica (se vacía al leerlo) */
export type FaunaNews =
  | { readonly type: 'arrived'; readonly species: number; readonly count: number }
  | { readonly type: 'born'; readonly species: number; readonly name: string; readonly mother: string; readonly twins: boolean; readonly count: number }
  | { readonly type: 'died'; readonly species: number; readonly name: string; readonly cause: DeathCause }
  | { readonly type: 'herdSplit'; readonly species: number }
  | { readonly type: 'hunger'; readonly species: number }
  | { readonly type: 'poisoned'; readonly species: number; readonly name: string; readonly plant: number }
  /** Una especie come por primera vez una planta (el jugador la descubre) */
  | { readonly type: 'discovered'; readonly species: number; readonly plant: number }
  /**
   * Un animal no ha vuelto a dormir con su manada: volverá por la mañana, se une a otra (bien o mal) o se queda
   * solo. Es el momento en que, más adelante, podrá saltar una decisión del jugador.
   */
  | { readonly type: 'lost'; readonly species: number; readonly name: string; readonly outcome: 'back' | 'joined' | 'rejected' | 'alone'; readonly id: number }
  /** Una manada sale huyendo a la vez (un susto contagiado) */
  | { readonly type: 'stampede'; readonly species: number }
  /** El jugador ha hecho correr a toda una manada: cuántos se han separado del grupo */
  | { readonly type: 'herdRun'; readonly species: number; readonly split: number }
  /** Una manada ha cavado su madriguera, o se la han derrumbado (Marea), tapado (Duna) o inundado */
  | { readonly type: 'burrow'; readonly species: number; readonly what: 'dug' | 'collapsed' | 'blocked' | 'flooded' }
  /** Brota una enfermedad en una especie (superpoblación) */
  | { readonly type: 'outbreak'; readonly species: number; readonly name: string }
  /** Un joven deja a los suyos para fundar su propia manada */
  | { readonly type: 'dispersed'; readonly species: number; readonly name: string };

/** El tiempo que hace, tal como lo notan los animales (lo pone quien lleva el reloj y el tiempo atmosférico) */
export interface FaunaConditions {
  /** Lluvia (0..1) */
  rain: number;
  /** Tormenta eléctrica: no se puede dormir */
  storm: boolean;
  snow: boolean;
  /** Frío (invierno): se apiñan y tienen más hambre */
  cold: boolean;
  /** Calor (verano despejado): sestean a la sombra y tienen más sed */
  hot: boolean;
  drought: boolean;
}

/** Cómo va una especie en la isla */
export interface SpeciesStats {
  readonly species: number;
  readonly population: number;
  /** Población que la comida de la isla puede alimentar ahora */
  readonly capacity: number;
  /** población / capacidad (más de 1 = sobrepoblación) */
  readonly density: number;
  readonly herds: number;
}

/** Los dados de una especie al soltar una manada: edad (días) y sexo de cada uno */
const FOUNDERS: readonly { sex: Sex; age: 'adult' | 'young' }[] = [
  { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'female', age: 'young' },
];

/**
 * Fauna de la isla. Cada minuto de juego mueve a cada animal y le hace comer o dormir; cada THINK_MINUTES piensa
 * qué hacer (huir, obedecer al jugador, dormir, comer, beber, seguir a su manada); cada hora repasa la población
 * (vejez, celo, partos, pisoteo, felicidad, manadas que se dividen, cadáveres y semillas).
 * Solo conoce el mundo por el puerto FaunaWorld y el azar por RandomSource: es lógica pura y se prueba sin Pixi.
 */
export class FaunaSystem {
  /** Animales vivos */
  readonly animals: Animal[] = [];
  /** Cadáveres (se quedan unos días) */
  readonly corpses: Animal[] = [];
  readonly herds = new Map<number, Herd>();
  readonly news: FaunaNews[] = [];
  private nextId = 1;
  private nextHerd = 1;
  private readonly capacity = new Map<number, number>();
  private readonly ateFavouriteAt = new Map<number, number>();
  private hungerToldDay = -1;
  /** Plantas que cada especie ya ha comido alguna vez ("especie:planta") */
  private readonly eaten = new Set<string>();

  /** El tiempo que hace ahora */
  conditions: FaunaConditions = { rain: 0, storm: false, snow: false, cold: false, hot: false, drought: false };
  /** Manadas que ya salieron en estampida este minuto (un aviso por manada) */
  private readonly stampeded = new Set<number>();

  /** Madrigueras de las especies con refugio */
  readonly burrows: Burrows;

  constructor(private readonly world: FaunaWorld, private readonly random: RandomSource) {
    this.burrows = new Burrows(world, random);
  }

  // ── Estímulos: algo pasa en el mundo y los animales lo notan ──

  /**
   * Un estímulo (arena que cae, un rayo, un manantial que brota...). Cada animal a su alcance reacciona según el
   * temperamento de su especie: le hace daño si le cae encima, le da miedo (menos con la costumbre), le da
   * curiosidad o hace que su manada evite la zona. El miedo es interno: se ve en lo que hace (alerta, huida).
   */
  sense(stim: Stimulus, now: number): void {
    // Lo que le hace a las madrigueras (la Marea las derrumba, la Duna las tapa)
    for (const h of this.burrows.hit(stim, SPECIES_DEFS)) this.burrowHit(h, now);
    const touched = new Map<Herd, boolean>();
    for (const a of [...this.animals]) {
      // Dentro de la madriguera no se entera de nada (está a salvo)
      if (a.inside !== null) continue;
      const s = SPECIES_DEFS[a.species];
      const def = TEMPERAMENTS[s.key]?.[stim.type];
      if (!def || def.reaction === 'ignore') continue;
      const d = Math.hypot(a.x - stim.gx, a.y - stim.gy);
      const herd = this.herds.get(a.herd);
      // Una madre no huye del cuerpo de su cría: se queda a su lado
      if (stim.type === 'corpse') {
        const dead = this.corpses.find(c => c.id === stim.animal);
        if (dead && dead.mother === a.id && d < 12) {
          write(a, 'grief', now, { name: dead.name }, true);
          continue;
        }
      }
      // Daño: arena que le cae encima, rayo al lado
      let harmed = false;
      if (stim.hurtRadius && d <= stim.hurtRadius) {
        harmed = true;
        const lightning = stim.type === 'lightning';
        a.health -= (lightning ? LIGHTNING_HEALTH : BURY_HEALTH) * stim.strength;
        write(a, lightning ? 'struck' : 'buried', now, undefined, true);
        if (a.health <= 0) {
          this.die(a, lightning ? 'lightning' : 'buried', now);
          if (herd) touched.set(herd, true);
          continue;
        }
      }
      const fear = fearOf(def, d, stim.strength, harmed ? 0 : habitLevel(herd, stim.type, now));
      if (herd) touched.set(herd, (touched.get(herd) ?? false) || harmed);
      if (fear <= 0.02 && !harmed) continue;
      this.frighten(a, fear, stim.gx, stim.gy, now);
      const used = habitLevel(herd, stim.type, now) > 0.5;
      write(a, used ? 'used' : `scare.${stim.type}`, now);
      if (def.reaction === 'curious') a.curious = { x: stim.gx, y: stim.gy, until: now + 6 * 60, key: stim.type, seen: false };
      if (def.avoidHours && herd) addZone(herd, stim.gx, stim.gy, Math.max(2, def.radius * 0.5), now + def.avoidHours * 60);
    }
    for (const [herd, harmed] of touched) habituate(herd, stim.type, now, harmed);
  }

  // ── Consultas ──

  animal(id: number): Animal | undefined {
    return this.animals.find(a => a.id === id) ?? this.corpses.find(a => a.id === id);
  }

  members(herd: number): Animal[] {
    return this.animals.filter(a => a.herd === herd);
  }

  stats(): SpeciesStats[] {
    return SPECIES_DEFS.map(s => {
      const population = this.animals.filter(a => a.species === s.id).length;
      const capacity = this.capacity.get(s.id) ?? 0;
      const herds = new Set(this.animals.filter(a => a.species === s.id).map(a => a.herd)).size;
      return { species: s.id, population, capacity, density: capacity > 0 ? population / capacity : population > 0 ? 9 : 0, herds };
    });
  }

  // ── Llegada de una manada (botón de desarrollo; más adelante, cartas y expansión) ──

  /**
   * Suelta una manada de fundadores (los de la especie o 2 hembras, 1 macho y 1 cría) en la celda global (gx, gy).
   * `withBurrow`: con la madriguera ya cavada (botones de prueba).
   */
  spawnHerd(speciesKey: string, gx: number, gy: number, now: number, withBurrow = false): Animal[] {
    const s = SPECIES_BY_KEY[speciesKey];
    if (!s) return [];
    const herd = this.newHerd(s.id, gx, gy);
    if (withBurrow) this.burrows.dig(herd, s, gx, gy, now, true);
    const out: Animal[] = [];
    for (const f of s.founders ?? FOUNDERS) {
      const days = f.age === 'young'
        ? 2 + this.random.next() * (s.youngDays - 4)
        : s.adultDays + this.random.next() * (s.lifespanDays[0] * 0.5 - s.adultDays);
      const mother = f.age === 'young' ? out.find(a => a.sex === 'female') ?? null : null;
      const a = this.create(s, f.sex, now - days * DAY, gx + (this.random.next() - 0.5) * 3, gy + (this.random.next() - 0.5) * 3, herd.id, mother, now);
      a.diary.length = 0;
      write(a, 'arrived', now, undefined, true);
      out.push(a);
    }
    this.news.push({ type: 'arrived', species: s.id, count: out.length });
    this.refreshCapacity(now, this.seasonOf(now));
    return out;
  }

  /** Modo desarrollo: las hembras adultas de una especie paren dentro de una hora (camadas por tirada) */
  debugBirths(speciesKey: string, now: number): number {
    const s = SPECIES_BY_KEY[speciesKey];
    if (!s || s.breeding.mode !== 'season') return 0;
    let n = 0;
    for (const f of this.animals) {
      if (f.species !== s.id || f.sex !== 'female' || ageDays(f, now) < s.adultDays) continue;
      f.litter = litterSize(s.breeding, f.satiety, false, this.random);
      f.dueAt = now + 60;
      n++;
    }
    return n;
  }

  /** Modo desarrollo: brota la enfermedad ahora en la manada más grande de una especie */
  debugOutbreak(speciesKey: string, now: number): boolean {
    const s = SPECIES_BY_KEY[speciesKey];
    if (!s?.disease) return false;
    let best: Animal[] = [];
    for (const h of this.herds.values()) {
      const m = this.members(h.id);
      if (h.species === s.id && m.length > best.length) best = m;
    }
    const zero = best.find(a => a.sickUntil === null && !a.immune);
    if (!zero) return false;
    infect(zero, s, now);
    write(zero, 'sick', now, undefined, true);
    this.news.push({ type: 'outbreak', species: s.id, name: zero.name });
    return true;
  }

  /** Modo desarrollo: todos los animales cumplen `days` días de golpe (para probar la vejez y el celo) */
  ageAll(days: number): void {
    for (const a of this.animals) (a as { bornAt: number }).bornAt -= days * DAY;
  }

  // ── Órdenes del jugador ──

  /**
   * El jugador le pide algo desde su ficha. Correr necesita algo de descanso (RUN_MIN): devuelve false si no puede.
   * - comer: va a la mejor comida cercana aunque se separe de la manada, hasta llenarse
   * - dormir: se tumba donde está hasta descansar del todo (cerca de su manada descansa mejor)
   * - correr: corre hasta cansarse; puede escapar de un peligro, pero también perder a su manada
   */
  order(id: number, order: AnimalOrder, now: number): boolean {
    const a = this.animals.find(x => x.id === id);
    if (!a) return false;
    if (order === 'run') {
      if (a.rest < RUN_MIN) return false;
      if (a.inside !== null) this.exit(a, now);
      const angle = this.random.next() * Math.PI * 2;
      a.pantUntil = 0;
      this.startRun(a, Math.cos(angle), Math.sin(angle), now);
    }
    if (order === 'eat' && a.inside !== null) this.exit(a, now);
    a.order = order;
    if (order === 'sleep') this.setAction(a, 'sleep', now);
    if (order === 'eat') this.goEat(a, SPECIES_DEFS[a.species], now, this.seasonOf(now), true);
    return true;
  }

  /**
   * Correr con toda la manada (orden desde la vista de lejos). Nada es seguro: cada adulto, con probabilidad
   * `herdRun.together`, sale con el grupo hacia el mismo lado (cada uno con su pequeña desviación); si no, se separa
   * y sale por su cuenta. Las crías van con su madre. Los separados se despistan: no vuelven solos con la manada y,
   * al caer la tarde, puede que no la encuentren (`herdRun.findBack`). Devuelve false si nadie puede correr.
   */
  orderHerd(id: number, now: number): boolean {
    const a = this.animals.find(x => x.id === id);
    if (!a) return false;
    const s = SPECIES_DEFS[a.species];
    const members = this.members(a.herd);
    // Con madriguera, el grupo corre hacia ella; si no, hacia cualquier lado
    const home = s.flight.mode === 'refuge' ? this.burrows.usable(this.herds.get(a.herd), now) : undefined;
    const base = home ? Math.atan2(home.y - a.y, home.x - a.x) : this.random.next() * Math.PI * 2;
    const chosen = new Map<number, { angle: number; together: boolean }>();
    let split = 0;
    // Primero los adultos (cada uno decide), luego las crías (van con su madre)
    for (const m of members) {
      if (ageDays(m, now) < s.youngDays || m.rest < RUN_MIN) continue;
      const together = this.random.next() < s.herdRun.together;
      const side = this.random.next() < 0.5 ? 1 : -1;
      const angle = together ? base + (this.random.next() - 0.5) * 0.5 : base + side * Math.PI * (0.35 + this.random.next() * 0.65);
      chosen.set(m.id, { angle, together });
      if (!together) split++;
    }
    for (const m of members) {
      if (ageDays(m, now) >= s.youngDays || m.rest < RUN_MIN) continue;
      chosen.set(m.id, chosen.get(m.mother ?? -1) ?? { angle: base, together: true });
    }
    if (!chosen.size) return false;
    for (const m of members) {
      const c = chosen.get(m.id);
      if (!c) continue;
      if (m.inside !== null) this.exit(m, now);
      m.pantUntil = 0;
      m.roam = null;
      m.order = 'run';
      m.strayed = c.together ? 0 : 1;
      this.startRun(m, Math.cos(c.angle), Math.sin(c.angle), now);
      if (home && c.together) m.runTo = { x: home.x, y: home.y };
    }
    this.news.push({ type: 'herdRun', species: a.species, split });
    return true;
  }

  // ── Paso del tiempo ──

  /** Un minuto de juego */
  minute(t: GameTime): void {
    const now = t.totalMinutes;
    this.stampeded.clear();
    for (const a of [...this.animals]) {
      if (a.diedAt !== null) continue;
      const s = SPECIES_DEFS[a.species];
      if ((now + a.id) % THINK_MINUTES === 0) this.think(a, s, t);
      this.act(a, s, t);
    }
    if (t.minute === 0) this.hour(t);
  }

  // ── Pensar ──

  private think(a: Animal, s: SpeciesDef, t: GameTime): void {
    const now = t.totalMinutes;
    if (a.action === 'run') return;   // corre hasta cansarse (o, si huye, hasta relajarse)
    // Dentro de la madriguera: duerme, cría y se esconde (sale cuando toca, por las tiradas de cada hora)
    if (a.inside !== null) return this.thinkInside(a, s, now);
    // Fuego al lado: miedo, del lado del fuego
    const danger = this.world.danger(Math.floor(a.x), Math.floor(a.y));
    if (danger.level > 0 && danger.level >= a.fear) {
      if (a.fear < FLEE_FEAR) write(a, 'scare.fire', now);
      // Con el fuego encima no se queda clavado: sale corriendo
      this.frighten(a, danger.level, danger.fromX, danger.fromY, now, true, danger.level < 1);
    }
    const members = this.members(a.herd);
    const herd = this.herds.get(a.herd);
    // La alarma se contagia (casi siempre: tirada de la especie): si un vecino de su manada huye, le entra el
    // miedo y huye hacia el mismo lado
    if (a.fear < FLEE_FEAR && this.random.next() < s.flight.alarm) {
      for (const m of members) {
        if (m === a || !m.fleeing || dist(m, a) > ALARM_RANGE) continue;
        // Si uno sale corriendo, salen todos (los ya asustados, con más motivo)
        // (solo si el que huye va de verdad asustado: así la ola no rebota sin fin entre ellos)
        this.frighten(a, Math.max(m.fear * ALARM_SHARE, m.fear >= FLEE_FEAR + 0.1 ? FLEE_FEAR : 0), m.fearX, m.fearY, now, true);
      }
    }
    // Mucho miedo: huye corriendo hasta ponerse a salvo (si ya lo está, solo vigila). Según la especie, lejos
    // del peligro o a su madriguera (si la tiene a mano). Si le ha tocado quedarse clavado, aún no sale.
    const refuge = s.flight.mode === 'refuge' && !a.strayed ? this.burrows.usable(herd, now) : undefined;
    const toRefuge = refuge && Math.hypot(a.x - refuge.x, a.y - refuge.y) <= s.range.flee * ISLAND * 2 ? refuge : undefined;
    const safe = !toRefuge && Math.hypot(a.x - a.fearX, a.y - a.fearY) >= s.range.flee * ISLAND;
    if (a.fear >= FLEE_FEAR && a.rest > RUN_STOP && !safe && now >= a.frozenUntil) {
      a.fleeing = true;
      a.order = null;
      if (toRefuge && Math.hypot(a.x - toRefuge.x, a.y - toRefuge.y) <= BURROW_ENTER) return this.enter(a, toRefuge, now);
      const away = toRefuge ? [toRefuge.x - a.x, toRefuge.y - a.y]
        : Math.hypot(a.x - a.fearX, a.y - a.fearY) > 0.1 ? [a.x - a.fearX, a.y - a.fearY] : [this.random.next() - 0.5, this.random.next() - 0.5];
      this.startRun(a, away[0], away[1], now);
      if (toRefuge) a.runTo = { x: toRefuge.x, y: toRefuge.y };
      if (members.filter(m => m.fleeing).length >= 3 && !this.stampeded.has(a.herd)) {
        this.stampeded.add(a.herd);
        this.news.push({ type: 'stampede', species: a.species });
      }
      return;
    }
    // Algo de miedo: se queda quieto, alerta, sin comer ni dormir
    if (a.fear >= STARTLE_FEAR) {
      if (a.action !== 'idle') this.setAction(a, 'idle', now);
      this.face(a, a.fearX - a.x, a.fearY - a.y);
      return;
    }
    // Recién parado de correr: jadea un rato, quieto (nada de tumbarse ni de echar a andar)
    if (now < a.pantUntil) {
      if (a.action !== 'idle') this.setAction(a, 'idle', now);
      return;
    }
    // Órdenes del jugador
    if (a.order === 'eat') {
      if (a.satiety >= FULL) a.order = null;
      else if (a.action !== 'eat') return this.goEat(a, s, now, t.season, true);
      else return;
    }
    if (a.order === 'sleep') {
      if (a.rest >= FULL) {
        a.order = null;
        this.setAction(a, 'idle', now);
      } else return;
    }
    const night = sleepTime(s, t.hour);
    const c = this.conditions;
    const siesta = c.hot && inHours(s.siestaHours, t.hour) && a.satiety > 0.4 && a.hydration > 0.5;
    // Con tormenta no hay quien duerma (salvo que se caiga de sueño)
    if (c.storm && a.action === 'sleep' && a.rest > 0.05) {
      write(a, 'storm', now);
      this.setAction(a, 'idle', now);
    }
    if (a.action === 'sleep') {
      // De día se despierta en cuanto ha descansado algo (salvo la siesta); de noche sigue dormido salvo que el hambre o la sed aprieten
      if (a.rest > 0.5 && (!night || a.satiety < 0.3 || a.hydration < 0.2) && !siesta) this.setAction(a, 'idle', now);
      else return;
    }
    const leader = leaderOf(members, s, now);
    const gather = this.gatherTime(a, s, t, leader);
    // Especies con refugio: si la manada (de dos o más) no tiene madriguera, la guía ocupa una abandonada o cava una
    if (herd && s.refuge && leader === a && members.length >= 2 && !this.burrows.get(herd.burrow)) {
      herd.burrow = null;
      if (this.burrows.adopt(herd, s, a.x, a.y)) write(a, 'newHome', now);
      else if (this.burrows.dig(herd, s, a.x, a.y, now)) {
        write(a, 'digging', now);
        this.news.push({ type: 'burrow', species: a.species, what: 'dug' });
      }
    }
    const home = s.refuge && !a.strayed ? this.burrows.usable(herd, now) : undefined;
    // La guía elige al caer la tarde dónde dormirá la manada (su madriguera; si no, bajo los árboles); de día no hay sitio
    if (herd && leader === a) {
      if (!gather) herd.bed = null;
      else if (!herd.bed) herd.bed = home ? { x: home.x, y: home.y } : this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 14) ?? { x: a.x, y: a.y };
    }
    // Con la adrenalina de una carrera no hay quien duerma (salvo que se caiga de agotamiento); tomando el sol, tampoco
    const wired = now < a.awakeUntil && a.rest > COLLAPSE;
    const basking = now < a.outUntil;
    const sleepy = (a.rest < SLEEP_BELOW || (night && a.rest < 0.9)) && !wired && !basking;
    if (sleepy && (!c.storm || a.rest < COLLAPSE || home)) {
      // Con madriguera duerme dentro: va a la entrada y se mete
      if (home && now >= a.stuckUntil) {
        if (Math.hypot(a.x - home.x, a.y - home.y) <= BURROW_ENTER) return this.enter(a, home, now);
        if (a.rest > COLLAPSE * 2) return this.walkTo(a, home.x, home.y, now);
      }
      // De noche se duerme con los suyos: si está lejos de su sitio, antes vuelve (salvo que no pueda más)
      const bed = herd?.bed;
      if (night && bed && leader !== a && !a.strayed && a.rest > COLLAPSE * 2 && now >= a.stuckUntil && Math.hypot(a.x - bed.x, a.y - bed.y) > s.herd.cohesion * 2) {
        return this.goToBed(a, s, bed, now);
      }
      // Antes de tumbarse, si el suelo está nevado o llueve, busca refugio bajo los árboles
      if ((this.world.snowAt(Math.floor(a.x), Math.floor(a.y)) || c.rain > 0.3) && a.rest > SLEEP_BELOW && this.toShelter(a, s, now, 8)) return;
      return this.setAction(a, 'sleep', now);
    }

    if (herd && leader === a) this.lead(a, herd, s, now, t.season);

    // Sed: bebe hasta llenarse; si tiene sed va al agua (antes que a comer, salvo que el hambre apriete más)
    if (a.action === 'drink') {
      if (a.hydration < FULL) return;
      this.setAction(a, 'idle', now);
    }
    if (a.hydration < THIRST_BELOW && a.satiety >= a.hydration * 0.6) return this.goDrink(a, s, now);
    if (a.action === 'eat' && a.satiety < FULL && !gather) return;
    // Comen sobre todo al amanecer y al atardecer; con calor, a mediodía apenas
    const eatBelow = inAnyHours(s.activeHours, t.hour) ? 0.85 : siesta ? 0.4 : EAT_BELOW;
    // De excursión come por allí (no vuelve con la manada a comer)
    if (a.satiety < eatBelow && !(gather && a.satiety > 0.3)) return this.goEat(a, s, now, t.season, !!a.roam);
    // Siesta a la sombra con calor; refugio bajo los árboles con lluvia o tormenta
    if (siesta) {
      if (this.toShelter(a, s, now, 10)) return;
      write(a, 'siesta', now);
      return this.setAction(a, 'sleep', now);
    }
    // Con lluvia o tormenta: a la madriguera (con su tirada) o bajo los árboles
    if ((c.rain > 0.3 || c.storm) && home && s.refuge && this.random.next() < perThink(s.refuge.rainStay)) {
      write(a, 'rainHome', now);
      if (Math.hypot(a.x - home.x, a.y - home.y) <= BURROW_ENTER) return this.enter(a, home, now);
      return this.walkTo(a, home.x, home.y, now);
    }
    if ((c.rain > 0.3 || c.storm) && !home && this.toShelter(a, s, now, 14)) {
      write(a, c.storm ? 'stormShelter' : 'rain', now);
      return;
    }
    // Curiosidad: cuando se le pasa el susto, va a mirar lo que le llamó la atención
    if (a.curious) {
      if (now > a.curious.until) a.curious = null;
      else if (a.fear < CURIOUS_BELOW) {
        if (Math.hypot(a.x - a.curious.x, a.y - a.curious.y) > 2) {
          // Le sale el '?' al echar a andar hacia lo que le llamó la atención
          if (!a.curious.seen) {
            a.curious.seen = true;
            this.signal(a, 'curious', now);
          }
          return this.walkTo(a, a.curious.x, a.curious.y, now);
        }
        write(a, `curious.${a.curious.key}`, now);
        a.curious = null;
      }
    }

    // Las crías siguen a su madre; los demás, a la manada (abierta al pastar, apiñada con miedo, sueño, frío o tormenta)
    const huddle = this.huddling(a, s, t);
    const spread = s.herd.cohesion * (huddle ? s.spacing.huddle : s.spacing.graze);
    const mother = a.mother !== null && ageDays(a, now) < s.youngDays ? this.animals.find(m => m.id === a.mother) : undefined;
    const anchor = mother ?? (leader && leader !== a ? leader : null);
    const reach = mother ? s.herd.cohesion * 0.6 : spread;
    // Al caer la tarde vuelve con los suyos, al sitio donde dormirá la manada
    const bed = herd?.bed;
    // Despistado tras una carrera: si se cruza con los suyos, los ha encontrado; al caer la tarde los busca y
    // los encuentra con algo de suerte; si no, anda por su cuenta (y esta noche se perderá)
    if (a.strayed) {
      if (anchor && dist(a, anchor) <= s.herd.cohesion * 3) this.foundHerd(a, now);
      else if (a.strayed === 1 && gather) {
        if (this.random.next() < s.herdRun.findBack) this.foundHerd(a, now);
        else a.strayed = 2;
      } else if (a.strayed === 2 && !gather) a.strayed = 1;
    }
    if (gather && !mother && !a.strayed) {
      if (a.roam) {
        a.roam = null;
        write(a, 'regroup', now);
      }
      const home = bed ?? (leader !== a ? anchor : null);
      if (home && now >= a.stuckUntil && Math.hypot(a.x - home.x, a.y - home.y) > reach * 1.4) return this.goToBed(a, s, home, now);
    }
    // De excursión por su cuenta (hasta su alcance): se acaba al cumplir su tiempo o si toca apiñarse
    const range = this.roamRange(a, s, now, leader);
    if (a.roam && (now > a.roam.until || huddle || gather || !anchor || dist(a, anchor) > range * 1.15)) a.roam = null;
    if (!a.roam && !a.strayed && anchor && dist(a, anchor) > reach * 1.4) {
      const [ox, oy] = this.offset(a.id, reach);
      return this.walkTo(a, anchor.x + ox, anchor.y + oy, now);
    }
    // Espacio personal: si tiene a otro demasiado cerca, se aparta un poco (apiñados, mucho menos)
    const personal = s.spacing.personal * (this.huddling(a, s, t) ? 0.3 : 1);
    const crowd = members.find(m => m !== a && m.id !== a.mother && m.mother !== a.id && dist(m, a) < personal * 0.8);
    if (crowd) {
      const dx = a.x - crowd.x, dy = a.y - crowd.y, d = Math.hypot(dx, dy) || 1;
      return this.walkTo(a, a.x + (dx / d) * personal, a.y + (dy / d) * personal, now);
    }
    // Solo: busca otra manada a la vista
    if (members.length === 1 && this.random.next() < 0.1) this.tryJoin(a, s, now);
    // A veces se va por su cuenta a ver mundo (de día, tranquilo y sin tener que apiñarse); antes que picar algo
    // más aquí, que con hierba de sobra se pasaría el día comiendo en el mismo sitio
    if (!a.roam && !a.strayed && range > 0 && anchor && !huddle && !gather && this.random.next() < ROAM_CHANCE && this.startRoam(a, s, anchor, range, now, t.season)) return;
    // De excursión: sigue hasta su sitio (si tiene hambre de verdad ya habrá parado a comer antes)
    if (a.roam && Math.hypot(a.x - a.roam.x, a.y - a.roam.y) > 2) {
      if (a.action !== 'walk' || Math.hypot(a.tx - a.roam.x, a.ty - a.roam.y) > 0.5) this.walkTo(a, a.roam.x, a.roam.y, now);
      return;
    }
    // Tranquilo: come si le apetece y hay comida, o da un paseíto
    if (a.satiety < FULL && this.world.foodAt(Math.floor(a.x), Math.floor(a.y), s.diets, this.avoid(a), now, t.season) > FOOD_HERE) {
      return this.setAction(a, 'eat', now);
    }
    if (this.random.next() < 0.3) {
      const [ox, oy] = this.offset(this.random.next() * 1000, spread);
      const base = a.roam ?? (a.strayed ? a : anchor) ?? a;
      if (!inZone(herd, base.x + ox, base.y + oy, now)) this.walkTo(a, base.x + ox, base.y + oy, now);
    } else if (a.action === 'walk' && reached(a)) this.setAction(a, 'idle', now);
  }

  /** Celdas que puede alejarse de su manada explorando: las crías y la guía, nada; una madre con cría, la mitad */
  private roamRange(a: Animal, s: SpeciesDef, now: number, leader: Animal | null): number {
    if (leader === a || ageDays(a, now) < s.youngDays) return 0;
    const calf = this.animals.some(k => k.mother === a.id && ageDays(k, now) < s.youngDays);
    const roam = a.sex === 'female' ? s.range.roamFemale ?? s.range.roam : s.range.roam;
    return roam * ISLAND * (calf ? 0.5 : 1);
  }

  /** Se va de excursión: a un sitio con buena comida a su alcance (lejos o cerca, según caiga) */
  private startRoam(a: Animal, s: SpeciesDef, home: Animal, range: number, now: number, season: SeasonId): boolean {
    const herd = this.herds.get(a.herd);
    let best: { x: number; y: number } | null = null, bestFood = FOOD_HERE;
    for (let n = 0; n < FORAGE_SAMPLES; n++) {
      const angle = this.random.next() * Math.PI * 2, r = range * (0.25 + 0.75 * this.random.next());
      const x = Math.floor(home.x + Math.cos(angle) * r), y = Math.floor(home.y + Math.sin(angle) * r);
      if (!this.world.walkable(x, y) || inZone(herd, x + 0.5, y + 0.5, now)) continue;
      const food = this.world.foodAt(x, y, s.diets, this.avoid(a), now, season);
      if (food > bestFood) {
        bestFood = food;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
    if (!best) return false;
    const [lo, hi] = ROAM_HOURS;
    a.roam = { ...best, until: now + (lo + this.random.next() * (hi - lo)) * 60 };
    write(a, 'explore', now);
    this.walkTo(a, best.x, best.y, now);
    return true;
  }

  /**
   * ¿Toca juntarse para dormir? De noche, en las horas de antes (gatherHours) o, si está lejos, cuando ya no le
   * queda más tiempo que el que tarda en volver andando.
   */
  private gatherTime(a: Animal, s: SpeciesDef, t: GameTime, leader: Animal | null): boolean {
    if (sleepTime(s, t.hour)) return true;
    const left = (s.sleepHours[0] * 60 - t.minuteOfDay + DAY) % DAY;
    // Lo que tarda en volver: a su madriguera si la tiene; si no, con su guía
    const burrow = s.refuge ? this.burrows.get(this.herds.get(a.herd)?.burrow ?? null) : undefined;
    const home = burrow ? Math.hypot(a.x - burrow.x, a.y - burrow.y) : leader && leader !== a ? Math.hypot(a.x - leader.x, a.y - leader.y) : 0;
    return left <= Math.max(s.gatherHours * 60, (home / s.speed.walk) * 1.3 + GATHER_MARGIN);
  }

  /** Va (andando) a su sitio de dormir, a su hueco junto a los demás */
  private goToBed(a: Animal, s: SpeciesDef, bed: { x: number; y: number }, now: number): void {
    const [ox, oy] = this.offset(a.id, s.herd.cohesion * s.spacing.huddle);
    const x = bed.x + ox, y = bed.y + oy;
    if (a.action === 'walk' && Math.hypot(a.tx - x, a.ty - y) < 0.5) return;
    this.walkTo(a, x, y, now);
  }

  /**
   * Le entra miedo (si es más del que ya tenía) desde (x, y). Al cruzar el umbral del susto le sale el '!'.
   * `quiet`: sin '!' si ya estaba asustado (el contagio y el fuego se repiten cada vez que piensa).
   * `canFreeze`: puede quedarse clavado un momento (tirada de la especie); con el fuego encima, no.
   */
  private frighten(a: Animal, fear: number, x: number, y: number, now: number, quiet = false, canFreeze = true): void {
    if (fear <= a.fear) return;
    const before = a.fear;
    a.fear = fear;
    a.fearX = x;
    a.fearY = y;
    // Al llegar al miedo de huir, a veces se queda clavado un momento antes de salir corriendo (tirada de la especie)
    if (canFreeze && before < FLEE_FEAR && fear >= FLEE_FEAR && this.random.next() < SPECIES_DEFS[a.species].flight.freeze) a.frozenUntil = now + FREEZE_MINUTES;
    else if (!canFreeze) a.frozenUntil = 0;
    if (fear >= STARTLE_FEAR && (before < STARTLE_FEAR || !quiet)) this.signal(a, 'alarm', now);
  }

  private signal(a: Animal, kind: AnimalSignal, now: number): void {
    a.signal = { kind, at: now };
  }

  /** Ir a beber: a la orilla del agua más cercana (a un paso del agua); si no hay a la vista, vaga buscándola */
  private goDrink(a: Animal, s: SpeciesDef, now: number): void {
    const w = this.world.nearestWater(Math.floor(a.x), Math.floor(a.y), s.thirstSearch);
    if (!w) {
      write(a, 'thirsty', now);
      for (let n = 0; n < 8; n++) {
        const angle = this.random.next() * Math.PI * 2;
        const x = a.x + Math.cos(angle) * FORAGE_RADIUS, y = a.y + Math.sin(angle) * FORAGE_RADIUS;
        if (this.world.walkable(Math.floor(x), Math.floor(y))) return this.walkTo(a, x, y, now);
      }
      return;
    }
    const wx = w.x + 0.5, wy = w.y + 0.5, d = Math.hypot(a.x - wx, a.y - wy);
    if (d <= DRINK_RANGE) {
      this.face(a, wx - a.x, wy - a.y);
      return this.setAction(a, 'drink', now);
    }
    // Si ya estaba yendo y no ha podido acercarse más, bebe desde donde está si el agua está a dos pasos
    if (a.action === 'walk' && reached(a) && d <= DRINK_RANGE + 1) return this.setAction(a, 'drink', now);
    this.walkTo(a, wx + ((a.x - wx) / d) * 1.1, wy + ((a.y - wy) / d) * 1.1, now);
  }

  /**
   * La guía elige adónde va la manada: donde haya buena comida (se queda mientras quede). Con madriguera, la
   * colonia come alrededor de ella: si la guía se ha alejado demasiado, vuelve hacia allí.
   */
  private lead(a: Animal, herd: Herd, s: SpeciesDef, now: number, season: SeasonId): void {
    const burrow = this.burrows.get(herd.burrow);
    const near = burrow ? FORAGE_RADIUS : Infinity;
    if (burrow && Math.hypot(a.x - burrow.x, a.y - burrow.y) > near) {
      herd.tx = burrow.x;
      herd.ty = burrow.y;
      return;
    }
    const food = this.world.foodAt(Math.floor(herd.tx), Math.floor(herd.ty), s.diets, herd.avoid, now, season);
    if (food > FOOD_HERE * 3 && Math.hypot(herd.tx - a.x, herd.ty - a.y) < FORAGE_RADIUS * 2) return;
    const spot = this.searchFood(a, s, herd.avoid, now, season, FORAGE_RADIUS);
    if (spot && burrow && Math.hypot(spot.x - burrow.x, spot.y - burrow.y) > near) return;
    if (spot) {
      herd.tx = spot.x;
      herd.ty = spot.y;
    }
  }

  /** Ir a comer: aquí si hay; si no, a su sitio junto a la manada (si allí hay) o al mejor que encuentre cerca */
  private goEat(a: Animal, s: SpeciesDef, now: number, season: SeasonId, alone: boolean): void {
    const avoid = this.avoid(a);
    const food = (x: number, y: number) => this.world.foodAt(Math.floor(x), Math.floor(y), s.diets, avoid, now, season);
    if (food(a.x, a.y) > FOOD_HERE) return this.setAction(a, 'eat', now);
    const herd = this.herds.get(a.herd);
    if (!alone && herd) {
      const [ox, oy] = this.offset(a.id, s.herd.cohesion * s.spacing.graze);
      const px = herd.tx + ox, py = herd.ty + oy;
      if (Math.hypot(px - a.x, py - a.y) > 1 && food(px, py) > FOOD_HERE) return this.walkTo(a, px, py, now);
    }
    const spot = this.searchFood(a, s, avoid, now, season, FORAGE_RADIUS) ?? this.searchFood(a, s, avoid, now, season, FORAGE_RADIUS * 2.5);
    if (spot) return this.walkTo(a, spot.x, spot.y, now);
    // Nada a la vista: vaga hacia algún sitio por el que se pueda andar, a ver si encuentra algo
    for (let n = 0; n < 8; n++) {
      const angle = this.random.next() * Math.PI * 2;
      const x = a.x + Math.cos(angle) * FORAGE_RADIUS, y = a.y + Math.sin(angle) * FORAGE_RADIUS;
      if (this.world.walkable(Math.floor(x), Math.floor(y))) return this.walkTo(a, x, y, now);
    }
  }

  /** El mejor sitio para comer a `radius` celdas (comida, un poco menos cuanto más lejos) */
  private searchFood(a: Animal, s: SpeciesDef, avoid: ReadonlySet<number>, now: number, season: SeasonId, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bestScore = FOOD_HERE;
    for (let n = 0; n < FORAGE_SAMPLES; n++) {
      const angle = this.random.next() * Math.PI * 2, r = 1 + this.random.next() * radius;
      const x = Math.floor(a.x + Math.cos(angle) * r), y = Math.floor(a.y + Math.sin(angle) * r);
      if (!this.world.walkable(x, y) || inZone(this.herds.get(a.herd), x + 0.5, y + 0.5, now)) continue;
      const score = this.world.foodAt(x, y, s.diets, avoid, now, season) / (1 + r * 0.05);
      if (score > bestScore) {
        bestScore = score;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
    return best;
  }

  // ── Actuar (cada minuto) ──

  private act(a: Animal, s: SpeciesDef, t: GameTime): void {
    const now = t.totalMinutes;
    if (a.inside !== null) {
      a.fear = Math.max(0, a.fear - FEAR_DECAY * 2);
      if (passTime(a, s, 1, now, this.needMods(a, s))) this.die(a, a.hydration <= 0 ? 'dehydration' : a.satiety <= 0 ? 'starvation' : 'exhaustion', now);
      return;
    }
    switch (a.action) {
      case 'eat': this.eatHere(a, s, now, t.season); break;
      case 'drink':
        a.hydration = Math.min(1, a.hydration + s.drinkPerMinute);
        if (a.hydration >= 1) this.setAction(a, 'idle', now);
        break;
      case 'walk':
        if (!this.step(a, s.speed.walk, now)) this.setAction(a, 'idle', now);
        break;
      case 'run': this.runStep(a, s, now); break;
    }
    // El miedo se pasa con el tiempo (corriendo, más deprisa: se desahoga)
    a.fear = Math.max(0, a.fear - FEAR_DECAY * (a.fleeing ? 3 : 1));
    if (passTime(a, s, 1, now, this.needMods(a, s))) {
      return this.die(a, a.hydration <= 0 ? 'dehydration' : a.satiety <= 0 ? 'starvation' : 'exhaustion', now);
    }
    // Fuego encima
    const d = this.world.danger(Math.floor(a.x), Math.floor(a.y));
    if (d.level >= 1) {
      a.health -= FIRE_HEALTH_PER_MINUTE;
      if (a.health <= 0) this.die(a, 'fire', now);
    }
  }

  private eatHere(a: Animal, s: SpeciesDef, now: number, season: SeasonId): void {
    const want = s.bitePerMinute * appetite(a, s, now);
    const meal = this.world.eat(Math.floor(a.x), Math.floor(a.y), s.diets, this.avoid(a), want, a.favourite, now, season);
    if (!meal) {
      this.setAction(a, 'idle', now);
      return;
    }
    const fill = meal.food / (s.stomach * appetite(a, s, now));
    a.satiety = Math.min(1, a.satiety + fill);
    // Plantas jugosas (cactus) y especies que sacan el agua de lo que comen: también quitan la sed
    const juicy = (PLANT_DEFS[meal.plant].drink ?? 0) + (s.waterFromFood ?? 0);
    if (juicy) a.hydration = Math.min(1, a.hydration + juicy * fill);
    const tasted = `${a.species}:${meal.plant}`;
    if (!this.eaten.has(tasted)) {
      this.eaten.add(tasted);
      this.news.push({ type: 'discovered', species: a.species, plant: meal.plant });
    }
    if (meal.fruit && a.seeds.length < 3) a.seeds.push({ plant: meal.plant, at: now });
    if (meal.plant === a.favourite) {
      const last = this.ateFavouriteAt.get(a.id) ?? -Infinity;
      if (now - last > DAY) write(a, 'favourite', now, { food: `@plant.${PLANT_DEFS[meal.plant].key}` });
      this.ateFavouriteAt.set(a.id, now);
    }
    this.poison(a, meal.plant, now);
    if (a.satiety >= FULL) {
      this.setAction(a, 'idle', now);
      if (a.order === 'eat') a.order = null;
    }
  }

  /** Planta tóxica: le quita vida según su efecto y la manada aprende a evitarla */
  private poison(a: Animal, plant: number, now: number): void {
    const toxic = PLANT_DEFS[plant].toxic;
    if (!toxic || this.random.next() >= toxic.chance) return;
    a.health -= TOXIC_HEALTH[toxic.effect];
    this.herds.get(a.herd)?.avoid.add(plant);
    write(a, `poison.${toxic.effect}`, now, { food: `@plant.${PLANT_DEFS[plant].key}` }, true);
    this.news.push({ type: 'poisoned', species: a.species, name: a.name, plant });
    if (a.health <= 0) this.die(a, 'poison', now);
  }

  /**
   * Avanza hacia su destino (o hacia el siguiente punto de su ruta). Devuelve false si ya ha llegado o no puede
   * seguir. Anda en línea recta; si algo le corta el paso y el destino está lejos, busca un camino (una vez por
   * destino: si no lo hay, rodea como pueda y no lo vuelve a buscar en un rato). Lo pequeño lo rodea girando.
   */
  private step(a: Animal, speed: number, now: number): boolean {
    let onPath = !!a.path?.length;
    let gx = onPath ? a.path![0] : a.tx, gy = onPath ? a.path![1] : a.ty;
    let dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
    if (d < 0.05) {
      if (!onPath) return false;
      a.path!.splice(0, 2);
      return true;
    }
    let k = Math.min(1, speed / d);
    // Bloqueado de frente con el destino lejos: busca un camino
    if (!onPath && a.path === null && now >= a.stuckUntil && Math.hypot(a.tx - a.x, a.ty - a.y) > PATH_FROM &&
        !this.canStep(a.x, a.y, a.x + dx * k, a.y + dy * k)) {
      a.path = findPath(Math.floor(a.x), Math.floor(a.y), Math.floor(a.tx), Math.floor(a.ty), this.heightAt, MAX_STEP, PATH_NODES) ?? [];
      if (!a.path.length) a.stuckUntil = now + STUCK_MINUTES;
      else {
        onPath = true;
        [gx, gy] = [a.path[0], a.path[1]];
        [dx, dy] = [gx - a.x, gy - a.y];
        d = Math.hypot(dx, dy);
        k = Math.min(1, speed / Math.max(d, 1e-6));
      }
    }
    // Si algo le corta el paso (agua, una terraza alta), lo rodea probando a girar cada vez más
    for (const turn of DETOURS) {
      const c = Math.cos(turn), sn = Math.sin(turn);
      const sx = (dx * c - dy * sn) * k, sy = (dx * sn + dy * c) * k;
      if (!this.canStep(a.x, a.y, a.x + sx, a.y + sy)) continue;
      this.face(a, sx, sy);
      a.x += sx;
      a.y += sy;
      if (!onPath) return d > speed;
      if (d <= speed) a.path!.splice(0, 2);
      return true;
    }
    // Ni rodeando: se da por vencido (y la ruta, si la había, ya no vale)
    if (onPath) a.path = [];
    return false;
  }

  private runStep(a: Animal, s: SpeciesDef, now: number): void {
    a.rest = Math.max(0, a.rest - RUN_TIRE_PER_MINUTE);
    // Corriendo hacia su madriguera: al llegar se mete dentro
    if (a.runTo) {
      const tx = a.runTo.x - a.x, ty = a.runTo.y - a.y, td = Math.hypot(tx, ty);
      const home = this.burrows.usable(this.herds.get(a.herd), now);
      if (home && td <= BURROW_ENTER) {
        this.endRun(a, s, now);
        return this.enter(a, home, now);
      }
      if (!home) a.runTo = null;
      else {
        a.runDx = tx / td;
        a.runDy = ty / td;
      }
    }
    // Quiebro: a veces cambia de golpe de dirección (zigzag, tirada de la especie)
    if (s.flight.zigzag && this.random.next() < s.flight.zigzag) {
      const turn = (this.random.next() < 0.5 ? 1 : -1) * 0.7, c = Math.cos(turn), sn = Math.sin(turn);
      [a.runDx, a.runDy] = [a.runDx * c - a.runDy * sn, a.runDx * sn + a.runDy * c];
    }
    // Hacia dónde le conviene ir: a su madriguera; huyendo, lejos del peligro; corriendo por orden, hacia donde iba
    const fx = a.x - a.fearX, fy = a.y - a.fearY, fd = Math.hypot(fx, fy);
    const [wx, wy] = a.fleeing && !a.runTo && fd > 0.1 ? [fx / fd, fy / fd] : [a.runDx, a.runDy];
    let moved = false;
    for (const turn of a.fleeing || !this.canStep(a.x, a.y, a.x + a.runDx * s.speed.run, a.y + a.runDy * s.speed.run) ? RUN_TURNS : [0]) {
      // Choca con algo: gira hacia el lado que más le aleje del peligro (el menor giro, si da igual)
      const c = Math.cos(turn), sn = Math.sin(turn);
      const dx = a.runDx * c - a.runDy * sn, dy = a.runDx * sn + a.runDy * c;
      if (turn !== 0 && dx * wx + dy * wy < -0.2) continue;   // nunca de vuelta hacia el peligro
      if (!this.canStep(a.x, a.y, a.x + dx * s.speed.run, a.y + dy * s.speed.run)) continue;
      a.runDx = dx;
      a.runDy = dy;
      a.x += dx * s.speed.run;
      a.y += dy * s.speed.run;
      moved = true;
      break;
    }
    this.face(a, a.runDx, a.runDy);
    // Para al ponerse a salvo (a la distancia de huida de su especie; antes si ya se le pasó el susto y ha
    // puesto media distancia de por medio), al haber corrido esa distancia por orden, al agotarse o si no puede seguir
    const far = s.range.flee * ISLAND * (a.runTo ? 2.5 : 1);
    const away = a.fleeing && !a.runTo ? fd : Math.hypot(a.x - a.runX, a.y - a.runY);
    const relaxed = a.fleeing && !a.runTo && a.fear < RELAXED && away >= far * 0.5;
    if (!moved || a.rest < RUN_STOP || away >= far || relaxed) this.endRun(a, s, now);
  }

  /** Altura de una celda para las rutas (NaN si no se pisa) */
  private readonly heightAt = (x: number, y: number): number => (this.world.walkable(x, y) ? this.world.height(x, y) : NaN);

  private canStep(x: number, y: number, nx: number, ny: number): boolean {
    const cx = Math.floor(nx), cy = Math.floor(ny);
    if (cx === Math.floor(x) && cy === Math.floor(y)) return true;
    if (!this.world.walkable(cx, cy)) return false;
    return Math.abs(this.world.height(cx, cy) - this.world.height(Math.floor(x), Math.floor(y))) <= MAX_STEP;
  }

  /** Hacia dónde mira en la pantalla isométrica: x de pantalla = x − y; de espaldas si sube por la pantalla */
  private face(a: Animal, dx: number, dy: number): void {
    const sx = dx - dy, sy = dx + dy;
    if (Math.abs(sx) > 0.01) a.facing = sx > 0 ? 1 : -1;
    a.back = sy < -0.01;
  }

  private startRun(a: Animal, dx: number, dy: number, now: number): void {
    const d = Math.hypot(dx, dy) || 1;
    a.runDx = dx / d;
    a.runDy = dy / d;
    if (a.action !== 'run') {
      a.runX = a.x;
      a.runY = a.y;
    }
    a.path = null;
    a.runTo = null;
    this.setAction(a, 'run', now);
  }

  /**
   * Para de correr: se queda jadeando un rato y, con la adrenalina, tarda en poder dormirse. Si huía, se vuelve
   * a mirar atrás (si el peligro sigue ahí, volverá a salir corriendo). Lejos de los suyos no pasa nada aún:
   * tiene hasta la noche para volver (si no, se ha perdido).
   */
  private endRun(a: Animal, s: SpeciesDef, now: number): void {
    this.setAction(a, 'idle', now);
    if (a.order === 'run') a.order = null;
    write(a, a.fleeing ? 'fled' : a.strayed ? 'split' : 'ran', now, undefined, a.strayed === 1);
    if (a.fleeing) this.face(a, a.fearX - a.x, a.fearY - a.y);
    a.fleeing = false;
    a.runTo = null;
    a.roam = null;
    a.pantUntil = now + s.afterRun.pant;
    a.awakeUntil = now + s.afterRun.awake;
  }

  // ── Madriguera ──

  /** Se mete en su madriguera: no se ve, está a salvo y duerme o descansa */
  private enter(a: Animal, b: Burrow, now: number): void {
    a.inside = b.id;
    a.x = a.tx = b.x;
    a.y = a.ty = b.y;
    a.fleeing = false;
    a.runTo = null;
    a.roam = null;
    a.path = null;
    a.outUntil = 0;
    this.setAction(a, a.rest < 0.95 ? 'sleep' : 'idle', now);
  }

  /** Sale de la madriguera, a su lado de la entrada */
  private exit(a: Animal, now: number): void {
    a.inside = null;
    const [ox, oy] = this.offset(a.id + now, 1.2);
    if (this.world.walkable(Math.floor(a.x + ox), Math.floor(a.y + oy))) {
      a.x += ox;
      a.y += oy;
    }
    a.tx = a.x;
    a.ty = a.y;
    this.setAction(a, 'idle', now);
  }

  /** Dentro: descansa; solo sale si el hambre o la sed aprietan (el resto lo deciden las tiradas de cada hora) */
  private thinkInside(a: Animal, s: SpeciesDef, now: number): void {
    const b = this.burrows.get(a.inside);
    if (!b) return this.exit(a, now);
    if (!this.nursling(a, s, now) && !b.blocked && a.fear < RELAXED && (a.satiety < INSIDE_HUNGRY || a.hydration < INSIDE_HUNGRY)) return this.exit(a, now);
    this.setAction(a, a.rest < 0.95 ? 'sleep' : 'idle', now);
  }

  /** Cría que aún no sale de la madriguera (la madre le da de mamar dentro) */
  private nursling(a: Animal, s: SpeciesDef, now: number): boolean {
    return s.breeding.mode === 'season' && a.mother !== null && ageDays(a, now) < s.breeding.nurseDays;
  }

  /** Una arena ha derrumbado o tapado una madriguera: lo que les pasa a los de dentro */
  private burrowHit(h: BurrowHit, now: number): void {
    const s = SPECIES_DEFS[h.burrow.species];
    const herd = this.herds.get(h.burrow.herd);
    const inside = this.animals.filter(a => a.inside === h.burrow.id);
    if (h.what === 'collapsed') {
      if (herd && herd.burrow === h.burrow.id) herd.burrow = null;
      for (const a of inside) {
        a.inside = null;
        if (this.random.next() < s.refuge!.collapseDeath) {
          write(a, 'buried', now, undefined, true);
          this.die(a, 'buried', now);
        } else {
          write(a, 'collapse', now, undefined, true);
          this.exit(a, now);
        }
      }
    } else for (const a of inside) write(a, 'blocked', now, undefined, true);
    this.news.push({ type: 'burrow', species: s.id, what: h.what });
  }

  /** Despistado, ha vuelto a dar con los suyos */
  private foundHerd(a: Animal, now: number): void {
    a.strayed = 0;
    write(a, 'foundHerd', now, undefined, true);
  }

  /**
   * Pasada la medianoche sigue lejos del sitio de dormir de su manada: se ha perdido. Volverá con los suyos por
   * la mañana, se une a otra manada (que lo acoge o lo echa) o se queda solo.
   */
  private lostAtNight(a: Animal, s: SpeciesDef, now: number): void {
    let outcome: 'back' | 'joined' | 'rejected' | 'alone';
    a.strayed = 0;
    if (this.random.next() < RETURN_CHANCE) {
      outcome = 'back';
      write(a, 'nightAlone', now, undefined, true);
    } else {
      const joined = this.tryJoin(a, s, now);
      outcome = joined === null ? 'alone' : joined ? 'joined' : 'rejected';
      if (joined === null) {
        a.herd = this.newHerd(a.species, a.x, a.y).id;
        write(a, 'alone', now, undefined, true);
      }
    }
    this.news.push({ type: 'lost', species: a.species, name: a.name, outcome, id: a.id });
  }

  /**
   * Intenta unirse a otra manada de su especie a la vista. Devuelve true si lo acogen, false si lo echan
   * (pierde vida y se queda solo) y null si no hay ninguna cerca.
   */
  private tryJoin(a: Animal, s: SpeciesDef, now: number): boolean | null {
    let best: { herd: number; d: number } | null = null;
    for (const h of this.herds.values()) {
      if (h.id === a.herd || h.id === a.leftHerd || h.species !== a.species) continue;
      const c = centre(this.members(h.id));
      if (!c) continue;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d <= JOIN_RANGE && (!best || d < best.d)) best = { herd: h.id, d };
    }
    if (!best) return null;
    const old = a.herd;
    if (this.random.next() < WELCOME_CHANCE) {
      a.herd = best.herd;
      write(a, 'joinedGood', now, undefined, true);
      if (!this.members(old).length) this.herds.delete(old);
      return true;
    }
    a.health = Math.max(0.01, a.health - REJECT_HEALTH);
    write(a, 'joinedBad', now, undefined, true);
    if (this.members(old).length > 1) a.herd = this.newHerd(a.species, a.x, a.y).id;
    return false;
  }

  // ── Cada hora: población ──

  private hour(t: GameTime): void {
    const now = t.totalMinutes;
    this.refreshCapacity(now, t.season);
    const perTile = new Map<string, number>();
    for (const a of [...this.animals]) {
      const s = SPECIES_DEFS[a.species];
      // Vejez (oculta: llega por sorpresa)
      if (ageDays(a, now) >= a.lifespan) {
        this.die(a, 'oldAge', now);
        continue;
      }
      // Semillas de la fruta que comió
      for (let n = a.seeds.length - 1; n >= 0; n--) {
        if (now - a.seeds[n].at < SEED_GUT_HOURS * 60) continue;
        this.world.dropSeed(a.seeds[n].plant, Math.floor(a.x), Math.floor(a.y));
        a.seeds.splice(n, 1);
      }
      const water = this.world.nearestWater(Math.floor(a.x), Math.floor(a.y), s.waterRange);
      // Con lluvia beben de los charcos
      if (this.conditions.rain > 0.3) a.hydration = Math.min(1, a.hydration + 0.03 * this.conditions.rain);
      // Felicidad
      const members = this.members(a.herd);
      const stats = this.capacity.get(s.id) ?? 0;
      const pop = this.animals.filter(x => x.species === s.id).length;
      const food = this.world.foodAt(Math.floor(a.x), Math.floor(a.y), s.diets, this.avoid(a), now, t.season);
      const fear = a.fear >= STARTLE_FEAR || this.world.danger(Math.floor(a.x), Math.floor(a.y)).level > 0;
      const crowded = stats > 0 ? pop / stats > CROWDED : pop > 1;
      updateHappiness(a, {
        goodFood: food > s.stomach * 0.5, ateFavourite: now - (this.ateFavouriteAt.get(a.id) ?? -Infinity) < DAY,
        herdSize: members.length, herdMin: s.herd.min, waterNear: !!water, crowded, fear, sick: a.sickUntil !== null,
      }, 60);
      this.musings(a, s, t, !!water, crowded, members.length);
      // Pisoteo
      const key = `${Math.floor(a.x / G)},${Math.floor(a.y / G)}`;
      perTile.set(key, (perTile.get(key) ?? 0) + (s.size === 'large' ? 1 : s.size === 'medium' ? 0.6 : 0.3));
    }
    for (const [key, n] of perTile) {
      const [i, j] = key.split(',').map(Number);
      this.world.trample(i * G + 1, j * G + 1, Math.min(0.5, TRAMPLE * n * n));
      if (n >= SOIL_DAMAGE_FROM) this.world.fertilize(i * G + 1, j * G + 1, -SOIL_DAMAGE * n * n);
    }
    // Cadáveres que se deshacen y abonan
    for (let n = this.corpses.length - 1; n >= 0; n--) {
      const c = this.corpses[n];
      if ((now - (c.diedAt ?? now)) / DAY < SPECIES_DEFS[c.species].corpseDays) continue;
      this.world.fertilize(Math.floor(c.x), Math.floor(c.y), CORPSE_FERTILITY);
      this.corpses.splice(n, 1);
    }
    this.refugeHour(t);
    this.diseaseHour(now);
    // Quien no ha vuelto a dormir con los suyos, se ha perdido
    for (const h of [...this.herds.values()]) {
      const s = SPECIES_DEFS[h.species];
      if (!h.bed || t.hour !== (s.sleepHours[0] + 2) % 24) continue;
      const members = this.members(h.id);
      if (members.length < 2) continue;
      for (const a of members) {
        if (ageDays(a, now) < s.youngDays) continue;
        if (Math.hypot(a.x - h.bed.x, a.y - h.bed.y) > s.herd.cohesion * LOST_NIGHT) this.lostAtNight(a, s, now);
      }
    }
    if (t.hour === 12) this.daily(t);
    // Manadas demasiado grandes se dividen
    for (const h of [...this.herds.values()]) {
      const s = SPECIES_DEFS[h.species];
      const members = this.members(h.id);
      if (!members.length) {
        this.herds.delete(h.id);
        continue;
      }
      if (members.length <= s.herd.max) continue;
      const leaving = splitOff(members, s, now);
      if (!leaving.length) continue;
      const angle = this.random.next() * Math.PI * 2;
      const nh = this.newHerd(h.species, h.tx + Math.cos(angle) * 8, h.ty + Math.sin(angle) * 8);
      for (const m of leaving) m.herd = nh.id;
      this.news.push({ type: 'herdSplit', species: h.species });
    }
  }

  /**
   * Madrigueras, cada hora (todo por tiradas de la especie): los de dentro salen al acabar sus horas de dormir, a
   * veces salen a tomar el sol, con lluvia se quedan; si se inunda, salen a tiempo o se ahogan; si está tapada,
   * la destapan.
   */
  private refugeHour(t: GameTime): void {
    const now = t.totalMinutes, c = this.conditions;
    const told = new Set<number>();
    for (const a of [...this.animals]) {
      const s = SPECIES_DEFS[a.species], r = s.refuge;
      if (!r || a.inside === null) continue;
      const b = this.burrows.get(a.inside);
      if (!b) {
        this.exit(a, now);
        continue;
      }
      if (this.burrows.flooded(b)) {
        if (!told.has(b.id)) {
          told.add(b.id);
          this.news.push({ type: 'burrow', species: s.id, what: 'flooded' });
        }
        if (this.random.next() < r.floodEscape) {
          write(a, 'flood', now, undefined, true);
          this.exit(a, now);
        } else if (this.random.next() < r.drownPerHour) this.die(a, 'drowned', now);
        continue;
      }
      if (b.blocked) {
        if (this.random.next() < r.unblock) {
          b.blocked = false;
          write(a, 'dugOut', now, undefined, true);
        }
        continue;
      }
      if (this.nursling(a, s, now) || a.sickUntil !== null && this.random.next() < 0.5) continue;
      const wet = c.rain > 0.3 || c.storm;
      if (sleepTime(s, t.hour)) {
        // En sus horas de dormir, alguno sale a tomar el sol a la entrada un rato
        if (!wet && this.random.next() < r.sunbathe) {
          this.exit(a, now);
          a.outUntil = now + 60;
          write(a, 'sunbathe', now);
        }
      } else if (wet ? this.random.next() >= r.rainStay : this.random.next() < r.leave && a.fear < RELAXED) this.exit(a, now);
    }
  }

  /** Enfermedad, cada hora: se contagia dentro de la manada, quita vida y, al acabar, mata o deja inmune */
  private diseaseHour(now: number): void {
    for (const h of this.herds.values()) {
      const s = SPECIES_DEFS[h.species];
      if (!s.disease) continue;
      const members = this.members(h.id);
      for (const m of spread(members, s, now, this.random)) write(m, 'sick', now, undefined, true);
    }
    for (const a of [...this.animals]) {
      if (a.sickUntil === null) continue;
      const s = SPECIES_DEFS[a.species];
      a.health = Math.max(0.05, a.health - 0.3 / 24);
      if (now < a.sickUntil) continue;
      if (recover(a, s, this.random)) this.die(a, 'disease', now);
      else write(a, 'recovered', now, undefined, true);
    }
  }

  /** Una vez al día (a mediodía): celo o cría por temporada, partos, crías sin madre, jóvenes que se van, enfermedad y aviso de hambre */
  private daily(t: GameTime): void {
    const now = t.totalMinutes;
    this.burrows.tidy(h => this.herds.has(h) && this.members(h).length > 0, now);
    for (const s of SPECIES_DEFS) {
      const all = this.animals.filter(a => a.species === s.id);
      const b = s.breeding;
      const capacity = this.capacity.get(s.id) ?? 0;
      const density = capacity > 0 ? all.length / capacity : all.length > 1 ? 9 : 0;
      if (b.mode === 'rut' && t.season === b.rutSeason) {
        for (const f of all) {
          const male = tryConceive(f, this.members(f.herd), s, now, t.year, 1, this.random);
          if (male) write(f, 'rut', now, { name: male.name });
        }
      }
      if (b.mode === 'season' && b.seasons.includes(t.season)) {
        for (const f of all) {
          const male = tryConceiveSeason(f, this.members(f.herd), s, now, density > CROWDED, this.random);
          if (male) write(f, 'mated', now, { name: male.name });
        }
      }
      for (const f of all) if (f.dueAt !== null && f.dueAt <= now) this.giveBirth(f, s, now);
      // Crías de madriguera: la madre les da de mamar si sigue con ellas; si no, cada día pueden no salir adelante
      if (b.mode === 'season') {
        for (const k of all) {
          if (!this.nursling(k, s, now)) continue;
          const mum = this.animals.find(m => m.id === k.mother && m.herd === k.herd);
          if (mum && (mum.inside === k.inside || Math.hypot(mum.x - k.x, mum.y - k.y) < 3)) {
            k.satiety = k.hydration = 1;
          } else if (this.random.next() < b.orphanDeath) this.die(k, 'orphaned', now);
        }
      }
      // Jóvenes que se hacen adultos: algunos se van a fundar su propia manada
      if (s.dispersal) {
        for (const a of all) {
          const age = ageDays(a, now);
          if (age < s.adultDays || age >= s.adultDays + 1 || this.members(a.herd).length < 2) continue;
          if (this.random.next() >= s.dispersal[a.sex]) continue;
          this.disperse(a, s, now);
        }
      }
      // Enfermedad: brota con superpoblación
      const zero = outbreak(all, s, density, this.random);
      if (zero) {
        infect(zero, s, now);
        write(zero, 'sick', now, undefined, true);
        this.news.push({ type: 'outbreak', species: s.id, name: zero.name });
      }
      const starving = all.filter(a => a.satiety < 0.1).length;
      if (all.length >= 4 && starving / all.length > 0.3 && this.hungerToldDay !== t.day) {
        this.hungerToldDay = t.day;
        this.news.push({ type: 'hunger', species: s.id });
      }
    }
  }

  private giveBirth(mother: Animal, s: SpeciesDef, now: number): void {
    const kids: Animal[] = [];
    for (let n = 0; n < mother.litter; n++) {
      const sex: Sex = this.random.next() < 0.5 ? 'male' : 'female';
      const kid = this.create(s, sex, now, mother.x + (this.random.next() - 0.5), mother.y + (this.random.next() - 0.5), mother.herd, mother, now);
      kid.satiety = 0.7;
      // Si la madre está en la madriguera, nacen dentro (y ahí se quedan sus primeros días)
      if (mother.inside !== null) {
        kid.inside = mother.inside;
        kid.x = kid.tx = mother.x;
        kid.y = kid.ty = mother.y;
        kid.action = 'sleep';
      }
      kids.push(kid);
    }
    mother.dueAt = null;
    if (s.breeding.mode === 'season') {
      // Camada: una sola noticia (cuántos y cómo se llama uno)
      if (kids.length) write(mother, 'litter', now, { count: kids.length, name: kids[0].name }, true);
      if (kids.length) this.news.push({ type: 'born', species: s.id, name: kids[0].name, mother: mother.name, twins: false, count: kids.length });
      return;
    }
    if (kids.length === 2) write(mother, 'twins', now, { name: kids[0].name, name2: kids[1].name }, true);
    else if (kids.length) write(mother, 'birth', now, { name: kids[0].name }, true);
    for (const k of kids) this.news.push({ type: 'born', species: s.id, name: k.name, mother: mother.name, twins: kids.length > 1, count: kids.length });
  }

  /** Un joven deja a los suyos: se va lejos (hasta su alcance) a fundar su propia manada (y cavará su madriguera) */
  private disperse(a: Animal, s: SpeciesDef, now: number): void {
    if (a.inside !== null) this.exit(a, now);
    const old = a.herd;
    a.leftHerd = old;
    a.herd = this.newHerd(s.id, a.x, a.y).id;
    if (!this.members(old).length) this.herds.delete(old);
    const roam = (a.sex === 'female' ? s.range.roamFemale ?? s.range.roam : s.range.roam) * ISLAND;
    for (let n = 0; n < 8; n++) {
      const angle = this.random.next() * Math.PI * 2, r = roam * (0.7 + this.random.next() * 0.5);
      const x = a.x + Math.cos(angle) * r, y = a.y + Math.sin(angle) * r;
      if (!this.world.walkable(Math.floor(x), Math.floor(y))) continue;
      this.walkTo(a, x, y, now);
      break;
    }
    write(a, 'leaveHome', now, undefined, true);
    this.news.push({ type: 'dispersed', species: s.id, name: a.name });
  }

  /** Lo que se le pasa por la cabeza (diario), con calma: unas pocas frases al día */
  private musings(a: Animal, s: SpeciesDef, t: GameTime, waterNear: boolean, crowded: boolean, herdSize: number): void {
    const now = t.totalMinutes;
    const r = this.random.next();
    if (a.action === 'sleep') {
      if (r < 0.04) write(a, 'dream', now);
      else if (r < 0.06) write(a, 'spaghetti', now);
      return;
    }
    if (a.hydration < 0.1 && r < 0.2) write(a, 'parched', now);
    else if (a.hydration < 0.3 && r < 0.12) write(a, 'thirsty', now);
    else if (a.satiety < 0.05 && r < 0.2) write(a, 'starving', now);
    else if (a.satiety < 0.25 && r < 0.1) write(a, 'hungry', now);
    else if (crowded && r < 0.08) write(a, 'crowded', now);
    else if (!waterNear && r < 0.06) write(a, 'waterFar', now);
    else if (herdSize === 1 && r < 0.06) write(a, 'lonely', now);
    else if (t.season === 3 && r < 0.03) write(a, 'cold', now);
    else if (lifeStage(a, s, now) === 'elder' && r < 0.02) write(a, 'old', now);
    else if (a.action === 'eat' && a.satiety > 0.6 && r < 0.12) write(a, 'goodGrass', now);
  }

  // ── Altas y bajas ──

  private create(s: SpeciesDef, sex: Sex, bornAt: number, x: number, y: number, herd: number, mother: Animal | null, now: number): Animal {
    const edible = PLANT_DEFS.filter(p => p.food?.diets.some(d => s.diets.includes(d)) && !p.toxic);
    const favourite = edible[Math.floor(this.random.next() * edible.length)]?.id ?? 0;
    const taken = new Set(this.animals.map(a => a.name));
    const name = nameFor(s.key, sex, favourite, mother?.favourite ?? null, this.random, taken);
    const [lo, hi] = s.lifespanDays;
    const a: Animal = {
      id: this.nextId++, species: s.id, sex, name, bornAt, lifespan: lo + this.random.next() * (hi - lo), favourite,
      mother: mother?.id ?? null, x, y, tx: x, ty: y, facing: this.random.next() < 0.5 ? 1 : -1, back: false, herd,
      health: 1, rest: 0.8, satiety: 0.8, hydration: 0.8, happiness: 0.6, factors: [], action: 'idle', actionSince: now, order: null,
      fear: 0, fearX: x, fearY: y, curious: null, fleeing: false, signal: null, pantUntil: 0, awakeUntil: 0, roam: null, path: null, stuckUntil: 0, strayed: 0,
      inside: null, outUntil: 0, frozenUntil: 0, runTo: null, sickUntil: null, immune: false, leftHerd: null,
      runDx: 0, runDy: 0, runX: x, runY: y, dueAt: null, litter: 0, lastRutYear: -1, seeds: [], diary: [], diaryDay: -1,
      diaryToday: 0, diedAt: null, cause: null,
    };
    write(a, 'born', now, undefined, true);
    this.animals.push(a);
    return a;
  }

  private die(a: Animal, cause: DeathCause, now: number): void {
    const i = this.animals.indexOf(a);
    if (i < 0) return;
    this.animals.splice(i, 1);
    a.diedAt = now;
    a.cause = cause;
    a.dueAt = null;
    a.order = null;
    a.action = 'dead';
    a.actionSince = now;
    this.corpses.push(a);
    this.news.push({ type: 'died', species: a.species, name: a.name, cause });
    if (!this.members(a.herd).length) this.herds.delete(a.herd);
    // Los demás notan el cuerpo (lo evitan; su madre no se separa de él)
    this.sense({ type: 'corpse', gx: a.x, gy: a.y, strength: 0.6, animal: a.id }, now);
  }

  private newHerd(species: number, x: number, y: number): Herd {
    const h: Herd = { id: this.nextHerd++, species, tx: x, ty: y, avoid: new Set(), habit: new Map(), zones: [], bed: null, burrow: null };
    this.herds.set(h.id, h);
    return h;
  }

  // ── Utilidades ──

  /** ¿Se apiña ahora? Con miedo, de noche, con frío o con tormenta la manada se aprieta */
  private huddling(a: Animal, s: SpeciesDef, t: GameTime): boolean {
    const c = this.conditions;
    return a.fear > 0.1 || sleepTime(s, t.hour) || c.cold || c.snow || c.storm;
  }

  /** Lo que el tiempo y la compañía cambian en sus necesidades */
  private needMods(a: Animal, s: SpeciesDef): NeedMods {
    const c = this.conditions;
    let rest = 1;
    if (a.action === 'sleep') {
      const together = this.members(a.herd).filter(m => m !== a && dist(m, a) < s.herd.cohesion).length >= 2;
      if (together) rest *= c.cold || c.snow ? 1.5 : 1.3;               // juntos se duerme mejor (y se pasa menos frío)
      // En la madriguera no le llega ni la nieve ni la lluvia
      if (a.inside === null && this.world.snowAt(Math.floor(a.x), Math.floor(a.y))) rest *= 0.6;
      if (a.inside === null && c.rain > 0.3 && !this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 1.5)) rest *= 0.75;
    }
    return { hunger: c.cold ? 1.2 : 1, thirst: (c.hot ? 1.3 : 1) * (c.drought ? 1.2 : 1), rest };
  }

  /** Va al refugio más cercano (bajo los árboles). Devuelve true si ha echado a andar hacia él (false si ya está o no hay). */
  private toShelter(a: Animal, s: SpeciesDef, now: number, range: number): boolean {
    const shelter = this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), range);
    if (!shelter) return false;
    const [ox, oy] = this.offset(a.id, s.spacing.personal * 0.6);
    const x = shelter.x + ox, y = shelter.y + oy;
    if (Math.hypot(a.x - x, a.y - y) < 1.5) return false;
    if (a.action === 'walk' && Math.hypot(a.tx - x, a.ty - y) < 0.5) return true;
    this.walkTo(a, x, y, now);
    return true;
  }

  /** Capacidad de cada especie: cuántos puede alimentar la comida en pie de la isla durante CAPACITY_DAYS */
  private refreshCapacity(now: number, season: SeasonId): void {
    for (const s of SPECIES_DEFS) {
      const daily = s.stomach * s.hungerPerDay;
      this.capacity.set(s.id, this.world.totalFood(s.diets, now, season) / (daily * CAPACITY_DAYS));
    }
  }

  private avoid(a: Animal): ReadonlySet<number> {
    return this.herds.get(a.herd)?.avoid ?? EMPTY;
  }

  private setAction(a: Animal, action: Animal['action'], now: number): void {
    if (a.action === action) return;
    a.action = action;
    a.actionSince = now;
  }

  private walkTo(a: Animal, x: number, y: number, now: number): void {
    // Destino nuevo: la ruta de antes ya no vale
    if (Math.hypot(a.tx - x, a.ty - y) > 0.5) a.path = null;
    a.tx = x;
    a.ty = y;
    this.setAction(a, 'walk', now);
  }

  /** Desplazamiento fijo de cada animal respecto a su manada (para que no se amontonen en el mismo punto) */
  private offset(seed: number, r: number): [number, number] {
    const h = Math.sin(seed * 12.9898) * 43758.5453;
    const angle = (h - Math.floor(h)) * Math.PI * 2;
    const k = Math.sin(seed * 78.233) * 12345.678;
    const rr = (0.4 + 0.6 * (k - Math.floor(k))) * r;
    return [Math.cos(angle) * rr, Math.sin(angle) * rr];
  }

  private seasonOf(now: number): SeasonId {
    return (Math.floor(now / DAY / CALENDAR.DAYS_PER_SEASON) % 4) as SeasonId;
  }
}

const EMPTY: ReadonlySet<number> = new Set();
/** Giros que prueba para rodear un obstáculo (primero recto) */
const DETOURS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8];
/** Giros que prueba corriendo, de menor a mayor (huyendo, nunca hacia el peligro) */
const RUN_TURNS = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1, 2.6, -2.6];
const dist = (a: Animal, b: Animal): number => Math.hypot(a.x - b.x, a.y - b.y);
/** Probabilidad por hora repartida entre las veces que piensa en esa hora */
const perThink = (perHour: number): number => 1 - Math.pow(1 - perHour, THINK_MINUTES / 60);
const reached = (a: Animal): boolean => Math.hypot(a.tx - a.x, a.ty - a.y) < 0.1;

/** ¿Está esta hora en el rango? (el rango puede cruzar la medianoche) */
function inHours([from, to]: readonly [number, number], hour: number): boolean {
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}
const inAnyHours = (ranges: readonly (readonly [number, number])[], hour: number): boolean => ranges.some(r => inHours(r, hour));

/** ¿Es hora de dormir? */
export function sleepTime(s: SpeciesDef, hour: number): boolean {
  return inHours(s.sleepHours, hour);
}
