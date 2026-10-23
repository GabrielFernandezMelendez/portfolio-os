import { Animal, AnimalOrder, AnimalSignal, Burrow, DeathCause, Herd, Sex } from '../../domain/models/animal.model';
import { SpeciesDef } from '../../domain/models/species.model';
import { CHUNKS_PER_PLOT } from '../../config/island.config';
import { GameTime, SeasonId, CALENDAR, toGameTime } from '../../domain/models/time.model';
import { FaunaWorld } from '../../domain/ports/fauna-world.port';
import { RandomSource } from '../../domain/ports/random-source.port';
import { WORLD } from '../../domain/models/world.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { SPECIES_BY_KEY, SPECIES_DEFS } from '../../config/species.config';
import {
  BURROW_ENTER, BONES_LEFT, CARRY_PIECE, CONTACT, MEAT_BITE, MEAT_BY_SIZE, CAPACITY_DAYS, COLLAPSE, CORPSE_FERTILITY, FREEZE_MINUTES, INSIDE_HUNGRY, CROWDED, DRINK_RANGE, EAT_BELOW, FIRE_HEALTH_PER_MINUTE,
  FOOD_HERE, FORAGE_RADIUS, FORAGE_SAMPLES, FULL, GATHER_MARGIN, JOIN_RANGE, LOST_NIGHT, MAX_STEP, PATH_FROM, PATH_NODES,
  REJECT_HEALTH, RETURN_CHANCE, ROAM_CHANCE, ROAM_HOURS, RUN_MIN, RUN_STOP, RUN_TIRE_PER_MINUTE, SEED_GUT_HOURS,
  SLEEP_BELOW, SOIL_DAMAGE, SOIL_DAMAGE_FROM, STUCK_MINUTES, THINK_MINUTES, THIRST_BELOW, TOXIC_HEALTH, TRAMPLE,
  WELCOME_CHANCE, DEN_MOTHER_STARVING, ALERT_REPEAT, LEAVE_HUNGRY_BELOW, KEEP_AWAY_MINUTES, FISH_AFTER_FAIL, JOIN_HUNT_RANGE, SOUND, STALK_FROM, STALK_SPEED, FISH_PER_TILE, FISH_REGROW_PER_DAY, FISH_MINUTES, SCAVENGE_SHARE, REFUGE_WARMTH, HUDDLE_WARMTH, SHADE_COOL, EXPOSURE_RATE, EXPOSURE_RECOVER, EXPOSURE_SEEK, EXPOSURE_DAMAGE, FEED_YOUNG_ABOVE, REGURGITATE, SHARE_RANGE, FIGHT_MINUTES, FIGHT_WOUND, FLY_FROM, SUN_HOURS, THIRST_URGENT, WATER_STUCK_MINUTES, WATER_GIVE_UP_HOURS, MIGRATION_EVERY_DAYS, LEAVE_HOURS, MEMORY_SPOTS, SEARCH_GROWTH, SEARCH_MAX_ISLANDS,
} from '../../config/fauna.config';
import { bonesLeft, CLEAN_BONES } from './carcass';
import { NeedMods, ageDays, appetite, lifeStage, passTime, updateHappiness } from './needs';
import { Stimulus } from '../../domain/models/stimulus.model';
import {
  ALARM_RANGE, ALARM_SHARE, BURY_HEALTH, CURIOUS_BELOW, FEAR_DECAY, FLEE_FEAR, LIGHTNING_HEALTH, RELAXED, STARTLE_FEAR, TEMPERAMENTS,
} from '../../config/temperament.config';
import { addZone, fearOf, habitLevel, habituate, inZone } from './reactions';
import { centre, leaderOf, splitOff } from './herds';
import { litterSize, tryConceive, tryConceiveSeason, arrivePregnant } from './breeding';
import { Burrows, BurrowHit } from './burrows';
import { infect, outbreak, recover, spread } from './disease';
import { catchChance, choosePrey, preyClass, smellChance } from './predation';
import { nameFor, write } from './diary';
import { Neighbours, sightRange, spotChance, waryOf } from './senses';
import { findPath } from './pathfinding';
import { arrivalChance, crowdLeaveChance, crowding, groupsCap, leaveChance, speciesCap } from './migration';

const DAY = CALENDAR.MINUTES_PER_DAY;
/** ¿Hora de sol? (de día, fuera del nido, el sol quema a los que viven de noche) */
const isSunHour = (hour: number): boolean => (hour % 24) >= SUN_HOURS[0] && (hour % 24) < SUN_HOURS[1];
/** Más lejos que esto (celdas) de su nido, vuelve corriendo antes del alba */
const COVER_RUN_FROM = 12;
const NO_DANGER = { level: 0, fromX: 0, fromY: 0 } as const;

/** Valor medio de una tirada entre dos enteros (0 si no hay) */
const mid = (r?: readonly [number, number]) => (r ? (r[0] + r[1]) / 2 : 0);

/** Apunta un sitio en la memoria de la manada: si ya tenía uno al lado, lo refresca; guarda los MEMORY_SPOTS últimos */
function remember(spots: { x: number; y: number }[], x: number, y: number): void {
  const i = spots.findIndex(p => Math.hypot(p.x - x, p.y - y) < 6);
  if (i >= 0) spots.splice(i, 1);
  spots.unshift({ x, y });
  if (spots.length > MEMORY_SPOTS) spots.length = MEMORY_SPOTS;
}
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
  | { readonly type: 'dispersed'; readonly species: number; readonly name: string }
  /** Un depredador ha cazado a una presa (`species` es la del depredador) */
  | { readonly type: 'killed'; readonly species: number; readonly prey: number; readonly name: string }
  /** Una presa grande ha plantado cara y ha echado a los depredadores */
  | { readonly type: 'repelled'; readonly species: number; readonly prey: number; readonly name: string }
  /** Una manada aúlla al anochecer (se oye en toda la isla) */
  | { readonly type: 'howl'; readonly species: number }
  /** Una manada se va de viaje de caza (poca presa cerca de su guarida) */
  | { readonly type: 'trip'; readonly species: number }
  /** Una manada se va de la isla (empieza a irse) y cuando el último sale */
  | { readonly type: 'leaving'; readonly species: number; readonly count: number }
  | { readonly type: 'left'; readonly species: number }
  /** Un grupo que se defiende ha matado a su atacante (humanos contra goblins o lobos) */
  | { readonly type: 'defended'; readonly species: number; readonly attacker: number; readonly name: string }
  /** Han nacido nidos en la Tierra Quemada */
  | { readonly type: 'burntBorn'; readonly species: number; readonly nests: number };

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
  /** El animal que se está moviendo ahora: ¿pisa el suelo quemado? ¿vuela? (lo fija minute() para cada uno) */
  private burntOk = false;
  private flying = false;
  /** Último minuto en que hubo animales de cada especie en la isla */
  private readonly lastSeen = new Map<number, number>();
  private readonly ateFavouriteAt = new Map<number, number>();
  private hungerToldDay = -1;
  /** Desde cuándo está solo cada animal de especie que no vive sola (`keepMin`), para irse si no encuentra grupo */
  private readonly loneSince = new Map<number, number>();
  /** Días seguidos que lleva cada manada con hambre de verdad (para irse de la isla) */
  private readonly hungryDays = new Map<number, number>();
  /**
   * Cuentas de la caza por especie de cazador (para medir el equilibrio): cacerías empezadas (y en manada de 3 o más), acechos descubiertos,
   * tiradas al alcanzarla que fallan, persecuciones perdidas o abandonadas, y presas cazadas (y en manada)
   */
  readonly huntStats = new Map<string, { hunts: number; packHunts: number; spotted: number; missed: number; lost: number; caught: number; packCaught: number }>();

  private huntStat(a: Animal) {
    const key = SPECIES_DEFS[a.species].key;
    let st = this.huntStats.get(key);
    if (!st) this.huntStats.set(key, (st = { hunts: 0, packHunts: 0, spotted: 0, missed: 0, lost: 0, caught: 0, packCaught: 0 }));
    return st;
  }
  /** Peces que quedan en los tiles donde se ha pescado (y desde cuándo, para reponerlos) */
  private readonly fishStock = new Map<string, { n: number; at: number }>();
  /** Plantas que cada especie ya ha comido alguna vez ("especie:planta") */
  private readonly eaten = new Set<string>();

  /** El tiempo que hace ahora */
  conditions: FaunaConditions = { rain: 0, storm: false, snow: false, cold: false, hot: false, drought: false };
  /** Manadas que ya salieron en estampida este minuto (un aviso por manada) */
  private readonly stampeded = new Set<number>();
  /** Depredadores acechando (se recalcula cada minuto) */
  private stalkers: Animal[] = [];
  /** Rejilla de vecinos para la vista y el oído (se rehace cada minuto) */
  private readonly neighbours = new Neighbours();

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
    for (const h of this.burrows.hit(stim)) this.burrowHit(h, now);
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
  spawnHerd(
    speciesKey: string, gx: number, gy: number, now: number, withBurrow = false,
    founders?: readonly { sex: Sex; age: 'adult' | 'young' }[],
    /** Llega de fuera (por la orilla, o un botón de prueba que la simula): alguna hembra puede venir preñada */
    arriving = false,
  ): Animal[] {
    const s = SPECIES_BY_KEY[speciesKey];
    if (!s) return [];
    const herd = this.newHerd(s.id, gx, gy);
    // Con su refugio ya hecho: el natural de la especie si lo tiene (cueva del lobo) o el que construye
    if (withBurrow) this.burrows.dig(herd, s, gx, gy, now, true, s.refuge?.natural ?? s.refuge?.kind);
    const out: Animal[] = [];
    for (const f of founders ?? s.founders ?? FOUNDERS) {
      const days = f.age === 'young'
        ? 2 + this.random.next() * (s.youngDays - 4)
        : s.adultDays + this.random.next() * (s.lifespanDays[0] * 0.5 - s.adultDays);
      const mother = f.age === 'young' ? out.find(a => a.sex === 'female') ?? null : null;
      const a = this.create(s, f.sex, now - days * DAY, gx + (this.random.next() - 0.5) * 3, gy + (this.random.next() - 0.5) * 3, herd.id, mother, now);
      a.diary.length = 0;
      write(a, 'arrived', now, undefined, true);
      out.push(a);
    }
    if (arriving && s.migration?.pregnant) {
      const year = toGameTime(now).year;
      for (const a of out) arrivePregnant(a, s, now, year, s.migration.pregnant, this.random);
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
    // Vista y oído: cada uno mira a su alrededor cuando le toca (presas que ven depredadores, acechos descubiertos)
    this.stalkers = this.animals.filter(a => a.hunt?.phase === 'stalk');
    this.perceive(t);
    for (const a of [...this.animals]) {
      if (a.diedAt !== null) continue;
      const s = SPECIES_DEFS[a.species];
      // Cómo pisa este animal: los que viven en la Tierra Quemada la pisan; las aves vuelan por encima de todo
      this.burntOk = !!s.fireproof;
      this.flying = s.locomotion === 'fly';
      if ((now + a.id) % THINK_MINUTES === 0) this.think(a, s, t);
      this.act(a, s, t);
    }
    this.burntOk = this.flying = false;
    if (t.minute === 0) this.hour(t);
  }

  // ── Pensar ──

  private think(a: Animal, s: SpeciesDef, t: GameTime): void {
    const now = t.totalMinutes;
    if (a.action === 'fight' || a.action === 'run') return;   // lucha o corre: lo lleva act minuto a minuto   // corre hasta cansarse (o, si huye, hasta relajarse)
    // Dentro de la madriguera: duerme, cría y se esconde (sale cuando toca, por las tiradas de cada hora)
    if (a.inside !== null) return this.thinkInside(a, s, now);
    // Fuego al lado: miedo, del lado del fuego (no a los que viven en la Tierra Quemada)
    const danger = s.fireproof ? NO_DANGER : this.world.danger(Math.floor(a.x), Math.floor(a.y));
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
    // Apartándose de un depredador que ha visto: sigue hasta su sitio (o hasta que se le pasa)
    if (a.keepAway) {
      const k = a.keepAway;
      if (now > k.until || Math.hypot(a.x - k.x, a.y - k.y) < 1) a.keepAway = null;
      else {
        if (a.action !== 'walk' || Math.hypot(a.tx - k.x, a.ty - k.y) > 0.5) this.walkTo(a, k.x, k.y, now);
        return;
      }
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
    // Se va de la isla: camino de la orilla (antes que comer, dormir o cazar)
    if (herd?.leaving) return this.thinkLeaving(a, herd, now);
    // Mucha sed: beber va antes que cazar, volver a casa o dormir (si está bebiendo, sigue hasta llenarse)
    if (a.action === 'drink' && a.hydration < FULL) return;
    if (a.hydration < THIRST_URGENT) return this.goDrink(a, s, now);
    // Con sed y agua a su alcance, bebe antes de ponerse a cazar o a dormir (si no, pasa la noche o la cacería con sed
    // teniendo el agua al lado). Si está persiguiendo o luchando, eso lo lleva act y no llega aquí
    if (a.hydration < THIRST_BELOW && !a.hunt && this.waterNear(a, s)) return this.goDrink(a, s, now);
    // Se acerca el día y el sol le quema, o es su estación de hibernar: a cubierto (a su refugio)
    if (this.takeCover(a, s, herd, t.hour, now)) return;
    // Pasa frío o calor: busca abrigo (su refugio o los suyos) o sombra
    if (this.seekComfort(a, s, herd, members, now)) return;
    // Depredador: cazar, comer carroña, llevar carne a las crías
    if (s.predator && this.thinkPredator(a, s, t, members, herd)) return;
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
      // (la sed de verdad le despierta aunque no haya descansado mucho)
      if ((a.rest > 0.5 && (!night || a.satiety < 0.3) && !siesta) || (a.hydration < THIRST_URGENT && a.rest > COLLAPSE)) this.setAction(a, 'idle', now);
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
    // (de viaje de caza, lejos de la guarida, no cuenta)
    const home = s.refuge && !a.strayed && !herd?.trip ? this.burrows.usable(herd, now) : undefined;
    // La guía elige al caer la tarde dónde dormirá la manada (su madriguera; si no, bajo los árboles); de día no hay sitio
    if (herd && leader === a) {
      if (!gather) herd.bed = null;
      else if (!herd.bed) {
        // De viaje de caza duermen fuera, donde estén; si no, en su refugio o bajo los árboles
        herd.bed = herd.trip ? { x: a.x, y: a.y } : home ? { x: home.x, y: home.y } : this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 14) ?? { x: a.x, y: a.y };
      }
    }
    // Con la adrenalina de una carrera no hay quien duerma (salvo que se caiga de agotamiento); tomando el sol, tampoco
    const wired = now < a.awakeUntil && a.rest > COLLAPSE;
    const basking = now < a.outUntil;
    const sleepy = (a.rest < SLEEP_BELOW || (night && a.rest < 0.9)) && !wired && !basking;
    if (sleepy && (!c.storm || a.rest < COLLAPSE || home)) {
      // Con madriguera duerme dentro: va a la entrada y se mete (si no se ha entretenido: entonces se duerme
      // donde le pille, fuera y a la intemperie)
      if (home && gather && now >= a.stuckUntil) {
        // Los que no duermen dentro (lobos adultos) se tumban a la entrada, cada uno en su hueco
        if (!s.refuge!.adultsInside && ageDays(a, now) >= s.youngDays) {
          const [ox, oy] = this.offset(a.id, s.herd.cohesion * s.spacing.huddle + 1);
          if (Math.hypot(a.x - home.x - ox, a.y - home.y - oy) > 1.5 && a.rest > COLLAPSE * 2) return this.walkTo(a, home.x + ox, home.y + oy, now);
        } else if (Math.hypot(a.x - home.x, a.y - home.y) <= BURROW_ENTER) return this.enter(a, home, now);
        else if (a.rest > COLLAPSE * 2) return this.walkTo(a, home.x, home.y, now);
      }
      // De noche se duerme con los suyos: si está lejos de su sitio, antes vuelve (salvo que no pueda más)
      const bed = herd?.bed;
      if (night && gather && bed && leader !== a && !a.strayed && a.rest > COLLAPSE * 2 && now >= a.stuckUntil && Math.hypot(a.x - bed.x, a.y - bed.y) > s.herd.cohesion * 2) {
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
    // (los carnívoros solo buscan plantas si pasan mucha hambre)
    if (a.satiety < eatBelow && !(gather && a.satiety > 0.3) && (!s.predator || a.satiety < (s.predator.plantsBelow ?? 0.2))) return this.goEat(a, s, now, t.season, !!a.roam);
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
    // Solo: busca otra manada a la vista; si su especie no vive sola (lobo), va a buscar un grupo pequeño de lejos
    if (members.length === 1) {
      if (this.random.next() < 0.1 && this.tryJoin(a, s, now)) return;
      const pack = this.smallPackNear(a, s);
      if (pack) {
        if (a.action !== 'walk' || Math.hypot(a.tx - pack.x, a.ty - pack.y) > 3) {
          if (a.action !== 'walk') write(a, 'seekPack', now);
          this.walkTo(a, pack.x, pack.y, now);
        }
        return;
      }
    }
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
      if (!this.walkable(x, y) || inZone(herd, x + 0.5, y + 0.5, now)) continue;
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
   * queda más tiempo que el que tarda en volver andando. Pero no siempre se da cuenta a tiempo: cada tarde tira
   * un dado (homing.late) y, si le toca, se entretiene y sale más tarde (y quizá no llegue: pasará la noche perdido).
   */
  private gatherTime(a: Animal, s: SpeciesDef, t: GameTime, leader: Animal | null): boolean {
    const left = (s.sleepHours[0] * 60 - t.minuteOfDay + DAY) % DAY;
    // Una tirada por noche (la noche es el minuto en que empieza la hora de dormir)
    const night = t.totalMinutes + (sleepTime(s, t.hour) ? -((t.minuteOfDay - s.sleepHours[0] * 60 + DAY) % DAY) : left);
    if (a.lateFor !== night) {
      a.lateFor = night;
      const [lo, hi] = s.homing.lateMinutes;
      a.lateBy = this.random.next() < s.homing.late ? lo + this.random.next() * (hi - lo) : 0;
    }
    if (sleepTime(s, t.hour)) return (t.minuteOfDay - s.sleepHours[0] * 60 + DAY) % DAY >= a.lateBy;
    if (a.lateBy > 0) return false;
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

  /**
   * Ir a beber: al agua más cercana que vea; si no ve ninguna, a la que recuerda la manada; si tampoco, busca cada
   * hora más lejos (y mientras tanto camina con rumbo, no al azar) hasta encontrarla o morir de sed.
   */
  private goDrink(a: Animal, s: SpeciesDef, now: number): void {
    const herd = this.herds.get(a.herd);
    const fx = Math.floor(a.x), fy = Math.floor(a.y);
    // El agua a la que ya sabe que no llega, se la salta (un rato)
    a.badWater = a.badWater.filter(b => b.until > now);
    const skip = a.badWater.length ? (x: number, y: number) => a.badWater.some(b => Math.abs(b.x - x) < 8 && Math.abs(b.y - y) < 8) : undefined;
    const w = this.world.nearestWater(fx, fy, s.thirstSearch, skip)
      ?? this.rememberedWater(a, herd, skip)
      ?? this.widerSearch(a, herd, 'water', s.thirstSearch, now, r => this.world.nearestWater(fx, fy, r, skip));
    if (!w) {
      write(a, 'thirsty', now);
      return this.searchWalk(a, now);
    }
    const wx = w.x + 0.5, wy = w.y + 0.5, d = Math.hypot(a.x - wx, a.y - wy);
    // ¿Se está acercando? Si en un rato no gana terreno, ese agua no es para él: la deja y busca otra
    const goal = a.waterGoal;
    if (!goal || Math.hypot(goal.x - w.x, goal.y - w.y) > 8) a.waterGoal = { x: w.x, y: w.y, best: d, at: now };
    else if (d < goal.best - 0.5) { goal.best = d; goal.at = now; }
    // Atascado (no encuentra camino) o sin acercarse en un rato: esa agua (y la de al lado) no es para él ahora
    const stuck = d > DRINK_RANGE + 1 && (now < a.stuckUntil || (a.waterGoal && now - a.waterGoal.at > WATER_STUCK_MINUTES));
    if (stuck) {
      a.badWater.push({ x: w.x, y: w.y, until: now + WATER_GIVE_UP_HOURS * 60 });
      if (herd) herd.water = herd.water.filter(p => Math.hypot(p.x - w.x, p.y - w.y) > 8);
      a.waterGoal = null;
      a.path = null;
      write(a, 'thirsty', now);
      this.setAction(a, 'idle', now);
      return this.searchWalk(a, now);
    }
    if (d <= DRINK_RANGE) {
      this.face(a, wx - a.x, wy - a.y);
      a.search = null;
      a.waterGoal = null;
      if (herd) remember(herd.water, w.x, w.y);
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
    // De viaje de caza: la manada va hacia allí hasta que se acaba (luego, de vuelta a la guarida)
    if (herd.trip) {
      if (now > herd.trip.until) {
        herd.trip = null;
        write(a, 'tripBack', now);
      } else {
        herd.tx = herd.trip.x;
        herd.ty = herd.trip.y;
        if (Math.hypot(a.x - herd.tx, a.y - herd.ty) > 3 && a.action !== 'walk') this.walkTo(a, herd.tx, herd.ty, now);
        return;
      }
    }
    const burrow = this.burrows.get(herd.burrow);
    const near = burrow ? FORAGE_RADIUS : Infinity;
    // Lejos de la madriguera: vuelve hacia ella, pero no siempre a la primera (tirada por hora de la especie)
    if (burrow && Math.hypot(a.x - burrow.x, a.y - burrow.y) > near && this.random.next() < perThink(s.homing.leaderReturn ?? 1)) {
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
      remember(herd.food, spot.x, spot.y);
    }
  }

  /** Ir a comer: aquí si hay; si no, a su sitio junto a la manada (si allí hay) o al mejor que encuentre cerca */
  private goEat(a: Animal, s: SpeciesDef, now: number, season: SeasonId, alone: boolean): void {
    const avoid = this.avoid(a);
    const food = (x: number, y: number) => this.world.foodAt(Math.floor(x), Math.floor(y), s.diets, avoid, now, season);
    if (food(a.x, a.y) > FOOD_HERE) {
      if (a.search?.kind === 'food') a.search = null;
      return this.setAction(a, 'eat', now);
    }
    const herd = this.herds.get(a.herd);
    if (!alone && herd) {
      const [ox, oy] = this.offset(a.id, s.herd.cohesion * s.spacing.graze);
      const px = herd.tx + ox, py = herd.ty + oy;
      if (Math.hypot(px - a.x, py - a.y) > 1 && food(px, py) > FOOD_HERE) return this.walkTo(a, px, py, now);
    }
    const near = this.searchFood(a, s, avoid, now, season, FORAGE_RADIUS) ?? this.searchFood(a, s, avoid, now, season, FORAGE_RADIUS * 2.5);
    if (near) {
      a.search = null;
      if (herd) remember(herd.food, near.x, near.y);
      return this.walkTo(a, near.x, near.y, now);
    }
    // Nada a la vista: a donde la manada recuerda haber comido bien; si no, busca cada hora más lejos
    const spot = this.rememberedFood(a, s, herd, now, season)
      ?? this.widerSearch(a, herd, 'food', FORAGE_RADIUS * 2.5, now, r => this.searchFood(a, s, avoid, now, season, r));
    if (spot) return this.walkTo(a, spot.x, spot.y, now);
    this.searchWalk(a, now);
  }

  // ── Memoria y búsqueda de agua y comida ──

  /** El agua que recuerda la manada, la más cercana que siga ahí (las que se han secado se olvidan) */
  private rememberedWater(a: Animal, herd: Herd | undefined, skip?: (x: number, y: number) => boolean): { x: number; y: number } | null {
    if (!herd) return null;
    const spots = [...herd.water].sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    for (const p of spots) {
      const w = this.world.nearestWater(p.x, p.y, 2, skip);
      if (w) return w;
      herd.water.splice(herd.water.indexOf(p), 1);
    }
    return null;
  }

  /** La comida que recuerda la manada, la más cercana que siga ahí (las que se han acabado se olvidan) */
  private rememberedFood(a: Animal, s: SpeciesDef, herd: Herd | undefined, now: number, season: SeasonId): { x: number; y: number } | null {
    if (!herd) return null;
    const spots = [...herd.food].sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    for (const p of spots) {
      if (this.world.foodAt(Math.floor(p.x), Math.floor(p.y), s.diets, herd.avoid, now, season) > FOOD_HERE) return p;
      herd.food.splice(herd.food.indexOf(p), 1);
    }
    return null;
  }

  /**
   * Búsqueda que crece: la primera vez apunta desde dónde busca; cada hora sin encontrar amplía el radio
   * (SEARCH_GROWTH, hasta SEARCH_MAX_ISLANDS islas) y vuelve a mirar. Lo que encuentra lo recuerda la manada.
   */
  private widerSearch(
    a: Animal, herd: Herd | undefined, kind: 'water' | 'food', base: number, now: number,
    find: (r: number) => { x: number; y: number } | null,
  ): { x: number; y: number } | null {
    if (!a.search || a.search.kind !== kind) {
      a.search = { kind, r: base, at: now, dir: this.random.next() * Math.PI * 2 };
      return null;
    }
    if (now - a.search.at < 60) return null;
    a.search.r = Math.min(SEARCH_MAX_ISLANDS * ISLAND, a.search.r * SEARCH_GROWTH);
    a.search.at = now;
    const found = find(a.search.r);
    if (found && herd) remember(kind === 'water' ? herd.water : herd.food, found.x, found.y);
    return found;
  }

  /** Mientras busca: camina con rumbo (si choca, gira), así recorre la isla en vez de dar vueltas en el sitio */
  private searchWalk(a: Animal, now: number): void {
    if (a.action === 'walk') return;
    const search = a.search ?? (a.search = { kind: 'water', r: 0, at: now, dir: this.random.next() * Math.PI * 2 });
    for (let n = 0; n < 8; n++) {
      const x = a.x + Math.cos(search.dir) * FORAGE_RADIUS, y = a.y + Math.sin(search.dir) * FORAGE_RADIUS;
      if (this.walkable(Math.floor(x), Math.floor(y))) return this.walkTo(a, x, y, now);
      search.dir += (this.random.next() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
  }

  /** El mejor sitio para comer a `radius` celdas (comida, un poco menos cuanto más lejos) */
  private searchFood(a: Animal, s: SpeciesDef, avoid: ReadonlySet<number>, now: number, season: SeasonId, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bestScore = FOOD_HERE;
    for (let n = 0; n < FORAGE_SAMPLES; n++) {
      const angle = this.random.next() * Math.PI * 2, r = 1 + this.random.next() * radius;
      const x = Math.floor(a.x + Math.cos(angle) * r), y = Math.floor(a.y + Math.sin(angle) * r);
      if (!this.walkable(x, y) || inZone(this.herds.get(a.herd), x + 0.5, y + 0.5, now)) continue;
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
    if (a.carrying > 0) a.rest = Math.max(0, a.rest - (s.tirePerDay / DAY) * ((s.predator?.carry.tire ?? 1) - 1));
    switch (a.action) {
      case 'eat':
        if (a.feeding !== null) this.feedOn(a, s, now);
        else this.eatHere(a, s, now, t.season);
        break;
      case 'howl':
        if (now - a.actionSince >= HOWL_MINUTES) this.setAction(a, 'idle', now);
        break;
      case 'drink':
        a.hydration = Math.min(1, a.hydration + s.drinkPerMinute);
        if (a.hydration >= 1) this.setAction(a, 'idle', now);
        break;
      case 'walk': {
        // Las aves vuelan si van lejos (más deprisa); cerca, andan a saltitos
        const far = s.speed.fly && Math.hypot(a.tx - a.x, a.ty - a.y) > FLY_FROM;
        // Agachado acechando: despacio
        const speed = far ? s.speed.fly! : s.speed.walk * (a.hunt?.crouch ? STALK_SPEED : 1);
        if (!this.step(a, speed, now)) this.setAction(a, 'idle', now);
        break;
      }
      case 'run': this.runStep(a, s, now); break;
      // Luchando: quieto (los golpes son cosa del dibujo); minuto a minuto mira si se acaba y se resuelve la tirada
      case 'fight': this.thinkFight(a, now); break;
    }
    // El miedo se pasa con el tiempo (corriendo, más deprisa: se desahoga)
    a.fear = Math.max(0, a.fear - FEAR_DECAY * (a.fleeing ? 3 : 1));
    if (passTime(a, s, 1, now, this.needMods(a, s))) {
      return this.die(a, a.hydration <= 0 ? 'dehydration' : a.satiety <= 0 ? 'starvation' : 'exhaustion', now);
    }
    // Fuego encima (a los que viven en la Tierra Quemada no les hace nada)
    const d = s.fireproof ? NO_DANGER : this.world.danger(Math.floor(a.x), Math.floor(a.y));
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
      // Sin camino: lo vuelve a intentar pasado un rato (desde donde esté entonces), no nunca
      if (!a.path.length) {
        a.path = null;
        a.stuckUntil = now + STUCK_MINUTES;
      }
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
    // Ni rodeando: se da por vencido un rato (y la ruta, si la había, ya no vale: la rehará desde aquí)
    a.path = null;
    a.stuckUntil = now + STUCK_MINUTES;
    return false;
  }

  private runStep(a: Animal, s: SpeciesDef, now: number): void {
    a.rest = Math.max(0, a.rest - RUN_TIRE_PER_MINUTE);
    // Persiguiendo una presa: corre hacia ella y, al alcanzarla, intenta cazarla
    if (a.hunt?.phase === 'chase' && this.chaseStep(a, s, now)) return;
    // Corriendo hacia su madriguera: al llegar se mete dentro (persiguiendo una presa, no: corre hacia ella)
    if (a.runTo && !a.hunt) {
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
    if (a.hunt) {
      // Persiguiendo: hacia la presa (sin giros raros)
      const nx = a.x + a.runDx * s.speed.run, ny = a.y + a.runDy * s.speed.run;
      if (this.canStep(a.x, a.y, nx, ny)) {
        this.face(a, a.runDx, a.runDy);
        a.x = nx;
        a.y = ny;
        return;
      }
    }
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
  private readonly heightAt = (x: number, y: number): number => (this.walkable(x, y) ? this.world.height(x, y) : NaN);

  /** ¿Puede estar aquí el animal que se mueve ahora? (con el suelo quemado si lo pisa; volando, cualquier sitio de la isla) */
  private walkable(x: number, y: number): boolean {
    if (this.flying) return this.world.materialAt(x, y) !== null;
    return this.world.walkable(x, y, this.burntOk);
  }

  private canStep(x: number, y: number, nx: number, ny: number): boolean {
    const cx = Math.floor(nx), cy = Math.floor(ny);
    if (cx === Math.floor(x) && cy === Math.floor(y)) return true;
    // Volando no le cortan el paso ni el agua ni las terrazas (solo el borde de la isla)
    if (this.flying) return this.walkable(cx, cy);
    if (!this.walkable(cx, cy)) return false;
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

  // ── Depredadores ──

  /**
   * Lo que hace un depredador antes que nada: seguir con su caza, llevar carne a las crías, comer carroña que
   * huele o salir a cazar si tiene hambre (todo por tiradas). Devuelve true si ha decidido algo.
   */
  private thinkPredator(a: Animal, s: SpeciesDef, t: GameTime, members: Animal[], herd: Herd | undefined): boolean {
    const now = t.totalMinutes, pred = s.predator!;
    const age = ageDays(a, now);
    // Madre con crías de guarida que aún maman: se queda junto a la guarida (la manada le trae comida)
    if (this.guardDen(a, s, members, herd, now)) return true;
    // Pescando: sigue hasta sacar algo o cansarse
    if (a.fishing && this.fish(a, s, now)) return true;
    // Banquete de la manada: si han cazado y le queda hambre, va a comer (también los jóvenes)
    if (herd?.feast != null && a.feeding === null && a.satiety < FULL - 0.05 && !this.nursling(a, s, now)) {
      const c = this.corpses.find(x => x.id === herd.feast);
      if (!c || c.meat <= this.leftovers(c, s)) herd.feast = null;
      else if (Math.hypot(c.x - a.x, c.y - a.y) <= SHARE_RANGE * ISLAND) {
        if (Math.hypot(c.x - a.x, c.y - a.y) <= CONTACT) {
          a.feeding = c.id;
          this.setAction(a, 'eat', now);
        } else this.walkTo(a, c.x, c.y, now);
        return true;
      }
    }
    // Los jóvenes aún no cazan solos; desde la mitad de su edad de cría pueden acompañar a una cacería (aprenden)
    if (age < s.youngDays && !(a.hunt && age >= s.youngDays / 2)) return false;
    // Cazando: acecha andando hacia la presa (la persecución va minuto a minuto, corriendo)
    if (a.hunt) {
      const prey = this.animals.find(p => p.id === a.hunt!.target);
      if (!prey || prey.inside !== null) {
        a.hunt = null;
        return false;
      }
      // Una persecución que ya no corre (se paró, se quedó atrás) se da por perdida: puede volver a cazar
      if (a.hunt.phase === 'chase' && a.action !== 'run' && a.action !== 'fight') {
        a.hunt = null;
        return false;
      }
      if (a.hunt.phase === 'stalk') {
        // Ya a la vista de su presa: se agacha y va despacio (así es más difícil que le vean)
        const crouch = dist(a, prey) <= SPECIES_DEFS[prey.species].senses.sight * STALK_FROM;
        if (crouch && !a.hunt.crouch) write(a, 'stalking', now, { prey: `@species.${SPECIES_DEFS[prey.species].key}` });
        a.hunt.crouch = crouch;
        if (dist(a, prey) <= CONTACT) {
          // Llega sin que le vea: le salta encima por sorpresa (cuerpo a cuerpo y, al acabar, la tirada)
          this.startFight(a, prey, now, true);
          return true;
        }
        this.walkTo(a, prey.x, prey.y, now);
        return true;
      }
      return false;
    }
    // Comiendo de un cadáver: sigue (lo lleva act)
    if (a.feeding !== null && a.action === 'eat') return true;
    // Con carne para las crías: a la guarida
    if (a.carrying > 0) return this.carryHome(a, s, members, herd, now);
    // Bien comido: lleva comida (la regurgita) al joven más hambriento de su manada que aún no caza por su cuenta
    if (pred.feedYoung && a.satiety >= FEED_YOUNG_ABOVE && this.random.next() < pred.feedYoung) {
      let best: Animal | null = null;
      for (const m of members) {
        // Los jóvenes que aún no cazan y la madre que no se mueve de la guarida
        const mum = this.denMother(m, s, members, now);
        if (m === a || m.inside !== null || this.nursling(m, s, now) || (ageDays(m, now) >= s.youngDays && !mum) || m.satiety >= 0.5) continue;
        if (Math.hypot(m.x - a.x, m.y - a.y) > SHARE_RANGE * ISLAND) continue;
        if (!best || m.satiety < best.satiety) best = m;
      }
      if (best) {
        if (dist(a, best) <= 2) {
          best.satiety = Math.min(1, best.satiety + REGURGITATE);
          a.satiety -= REGURGITATE / 2;
          write(a, 'feedYoung', now, { name: best.name });
          this.setAction(a, 'idle', now);
        } else this.walkTo(a, best.x, best.y, now);
        return true;
      }
    }
    const nursing = herd ? members.some(m => this.nursling(m, s, now) && m.inside !== null) : false;
    const hungry = a.satiety < pred.huntBelow;
    if (!hungry && a.search?.kind === 'prey') a.search = null;
    // Carroña: si huele un cadáver con carne (y tiene algo de hambre o hay crías esperando), va a por él. Antes de
    // tener hambre de cazar ya vuelve a rematar lo que hay (`carrionBelow`): así no caza otra presa con la anterior a medias
    const peckish = a.satiety < (pred.carrionBelow ?? pred.huntBelow);
    if (hungry || peckish || (nursing && a.satiety >= 0.8)) {
      const carrion = this.smellCarrion(a, s);
      if (carrion && this.random.next() < pred.carrion) {
        if (Math.hypot(a.x - carrion.x, a.y - carrion.y) <= CONTACT) {
          if (!hungry && !peckish && nursing) {
            // Ya ha comido: coge un trozo para las crías
            const piece = Math.min(CARRY_PIECE, carrion.meat);
            carrion.meat -= piece;
            a.carrying = piece;
            write(a, 'carryMeat', now);
            return this.carryHome(a, s, members, herd, now);
          }
          a.feeding = carrion.id;
          this.setAction(a, 'eat', now);
          // Los carroñeros recuerdan dónde aparecen cadáveres (vuelven a mirar: donde caza el lobo)
          if (herd && pred.revisit) remember(herd.kills, carrion.x, carrion.y);
          return true;
        }
        this.walkTo(a, carrion.x, carrion.y, now);
        return true;
      }
      // Sin carroña a la vista: a veces vuelve a mirar donde la encontró otras veces
      if (hungry && herd?.kills.length && pred.revisit && a.action !== 'walk' && this.random.next() < perThink(pred.revisit)) {
        const spot = herd.kills[Math.floor(this.random.next() * herd.kills.length)];
        write(a, 'revisit', now);
        this.walkTo(a, spot.x + (this.random.next() - 0.5) * 4, spot.y + (this.random.next() - 0.5) * 4, now);
        return true;
      }
    }
    // Hambre: sale a cazar (tirada por hora); los compañeros cercanos se le unen (tirada)
    // Después de una caza fallida, con hambre y agua honda cerca: a pescar (el plan B)
    if (hungry && now - a.huntFailedAt < FISH_AFTER_FAIL && this.startFishing(a, s, now)) return true;
    if (hungry && a.rest > RUN_MIN && this.random.next() < perThink(pred.huntChance)) {
      const prey = choosePrey(a, s, this.animals, SPECIES_DEFS, x => this.alone(x), now, this.random);
      if (!prey) return this.searchPrey(a, s, members, now);
      if (a.search?.kind === 'prey') a.search = null;
      a.hunt = { target: prey.id, phase: 'stalk', since: now };
      a.roam = null;
      write(a, 'hunting', now, { prey: `@species.${SPECIES_DEFS[prey.species].key}` });
      for (const m of members) {
        // Cazan juntos: se apuntan los de la manada a su alcance (JOIN_HUNT_RANGE) aunque no tengan mucha hambre; la
        // madre que amamanta no (se queda en la guarida)
        if (m === a || m.hunt || ageDays(m, now) < s.youngDays / 2 || dist(m, a) > JOIN_HUNT_RANGE || m.rest <= RUN_MIN) continue;
        if (this.denMother(m, s, members, now)) continue;
        // Con hambre se apunta casi siempre (`joinHunt`); bien comido, menos cuanto más lleno: si la manada ha pasado
        // hambre van todos juntos (y la manada entera junta caza casi siempre: `packCatch`)
        const join = m.satiety < pred.huntBelow ? pred.joinHunt : pred.joinHunt * Math.max(0, (1 - m.satiety) / (1 - pred.huntBelow));
        if (this.random.next() < join) m.hunt = { target: prey.id, phase: 'stalk', since: now };
      }
      this.huntStat(a).hunts++;
      if (members.filter(m => m.hunt?.target === prey.id).length >= 3) this.huntStat(a).packHunts++;
      this.walkTo(a, prey.x, prey.y, now);
      return true;
    }
    // Buscando presa: sigue su rumbo (entre tirada y tirada de caza)
    if (hungry && a.search?.kind === 'prey') return this.searchPrey(a, s, members, now);
    return false;
  }

  /**
   * Con hambre y sin oler ninguna presa (su olfato no llega: la isla es grande): se va a buscar con rumbo, como los
   * herbívoros buscan comida, y sigue oliendo por el camino. La guía marca el rumbo y la manada la sigue.
   */
  private searchPrey(a: Animal, s: SpeciesDef, members: Animal[], now: number): boolean {
    // Con agua honda cerca, antes que andar sin rumbo: a pescar (cada uno por su cuenta)
    if (this.startFishing(a, s, now)) return true;
    const leader = leaderOf(members, s, now);
    if (leader && leader !== a) return false;
    if (a.search?.kind !== 'prey') {
      a.search = { kind: 'prey', r: 0, at: now, dir: this.random.next() * Math.PI * 2 };
      write(a, 'searchPrey', now);
    }
    this.searchWalk(a, now);
    return true;
  }

  /** ¿Tiene agua para beber a su alcance de siempre (`waterRange`)? */
  private waterNear(a: Animal, s: SpeciesDef): boolean {
    return !!this.world.nearestWater(Math.floor(a.x), Math.floor(a.y), s.waterRange);
  }

  /** Peces que quedan en un tile (se reponen con los días, hasta FISH_PER_TILE) */
  private fishLeft(gx: number, gy: number, now: number): number {
    const key = `${Math.floor(gx / G)},${Math.floor(gy / G)}`;
    const f = this.fishStock.get(key);
    if (!f) return FISH_PER_TILE;
    return Math.min(FISH_PER_TILE, f.n + ((now - f.at) / DAY) * FISH_REGROW_PER_DAY);
  }

  /** Con hambre y agua honda con peces a su alcance (`waterRange`): va a pescar. Devuelve si lo hace */
  private startFishing(a: Animal, s: SpeciesDef, now: number): boolean {
    const f = s.fishing;
    if (!f || a.satiety >= f.below || a.inside !== null) return false;
    const spot = this.world.fishWater(Math.floor(a.x), Math.floor(a.y), s.waterRange, (x, y) => this.fishLeft(x, y, now) < 1);
    if (!spot) return false;
    a.fishing = { x: spot.x, y: spot.y, until: now + FISH_MINUTES };
    a.search = null;
    write(a, 'fishing', now);
    this.walkTo(a, spot.x, spot.y, now);
    return true;
  }

  /**
   * Pescando: va a la orilla (junto a su celda de agua) y, cada vez que piensa, tirada de `catch`; un pez da `gain`
   * de saciedad (poco) y quita uno del tile. Lo deja al quitarse el hambre, si se acaba el rato o si no quedan peces.
   */
  private fish(a: Animal, s: SpeciesDef, now: number): boolean {
    const f = s.fishing, spot = a.fishing!;
    if (!f || now > spot.until || a.satiety >= Math.min(1, f.below + 0.25) || this.fishLeft(spot.x, spot.y, now) < 1) {
      a.fishing = null;
      return false;
    }
    if (Math.hypot(a.x - spot.x, a.y - spot.y) > 1.6) {
      if (a.action !== 'walk') this.walkTo(a, spot.x, spot.y, now);
      // Si no llega (el agua no se pisa), se queda en la orilla más cercana a la que llega
      if (a.action === 'walk' && reached(a)) this.setAction(a, 'idle', now);
      else return true;
    }
    this.setAction(a, 'idle', now);
    if (this.random.next() < f.catch) {
      const key = `${Math.floor(spot.x / G)},${Math.floor(spot.y / G)}`;
      this.fishStock.set(key, { n: this.fishLeft(spot.x, spot.y, now) - 1, at: now });
      a.satiety = Math.min(1, a.satiety + f.gain);
      write(a, 'fished', now);
    }
    return true;
  }

  /** ¿Es madre de crías de guarida que aún maman? (la loba que se queda con sus lobeznos) */
  private denMother(a: Animal, s: SpeciesDef, members: Animal[], now: number): boolean {
    if (!s.breeding.nurseDays || a.sex !== 'female') return false;
    return members.some(k => k.mother === a.id && this.nursling(k, s, now));
  }

  /**
   * La madre de crías de guarida se queda cerca de la guarida mientras maman: no caza ni se va de viaje (si no, las
   * crías se quedan sin mamar y mueren). Sale a beber (lo lleva la sed) y, si pasa hambre de verdad, a comer lo que
   * haya cerca. La manada le regurgita comida, como a los jóvenes. Devuelve si se ha ocupado de ella.
   */
  private guardDen(a: Animal, s: SpeciesDef, members: Animal[], herd: Herd | undefined, now: number): boolean {
    if (!this.denMother(a, s, members, now)) return false;
    a.hunt = null;
    if (a.search?.kind === 'prey') a.search = null;
    if (a.hydration < THIRST_BELOW || a.satiety < DEN_MOTHER_STARVING) return false;
    const den = this.burrows.usable(herd, now);
    if (!den) return false;
    if (a.feeding !== null && a.action === 'eat') return true;
    const d = Math.hypot(a.x - den.x, a.y - den.y);
    if (d > s.herd.cohesion * 0.8) {
      if (a.action !== 'walk' || Math.hypot(a.tx - den.x, a.ty - den.y) > 1.5) this.walkTo(a, den.x + 1, den.y + 1, now);
    } else if (a.action === 'walk' && reached(a)) this.setAction(a, a.rest < 0.9 ? 'sleep' : 'idle', now);
    else if (a.action !== 'sleep' && a.action !== 'idle' && a.action !== 'walk') this.setAction(a, 'idle', now);
    return true;
  }

  /** El cadáver con carne que huele (el más cercano de los que huele, por tirada de distancia) */
  private smellCarrion(a: Animal, s: SpeciesDef): Animal | null {
    let best: Animal | null = null, bestD = Infinity;
    for (const c of this.corpses) {
      if (c.meat <= this.leftovers(c, s)) continue;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d < bestD && (d <= CONTACT || this.random.next() < smellChance(s, d))) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Carne que un comedor deja en el cadáver: casi nada para quien pica los huesos (cuervo); para los demás, los
   * restos pegados a los huesos (BONES_LEFT de la carne que tenía al morir), que ya no les compensa.
   */
  private leftovers(c: Animal, s: SpeciesDef): number {
    return s.predator?.bones ? CLEAN_BONES : bonesLeft(c);
  }

  /** ¿Va sola? (lejos de su manada, despistada o de una manada de uno): presa fácil */
  private alone(a: Animal): boolean {
    if (a.strayed) return true;
    const m = this.members(a.herd);
    if (m.length <= 1) return true;
    const s = SPECIES_DEFS[a.species];
    return !m.some(o => o !== a && dist(o, a) < s.herd.cohesion * 3);
  }

  /**
   * Vista (cada animal, cuando le toca pensar). Una presa mira a su alcance (`sight`, menos de noche y entre árboles):
   * - Un depredador que acecha agachado: tirada para verlo (más cerca, más fácil; sigilo y comer lo hacen difícil).
   *   Si lo ve, lo descubre: miedo y huida para los de alrededor, y los que acechaban pasan a perseguir.
   * - Uno que se ve (no se esconde): según la distancia, deja de comer y lo mira ('!'), o se aparta.
   * Así una presa mantiene la distancia con quien la caza, y el depredador tiene que acercarse con sigilo.
   */
  private perceive(t: GameTime): void {
    const now = t.totalMinutes, night = !isSunHour(t.hour);
    this.neighbours.build(this.animals);
    const found = new Set<Animal>();
    for (const a of this.animals) {
      if ((now + a.id) % THINK_MINUTES !== 0) continue;
      const s = SPECIES_DEFS[a.species];
      if (!s.senses.wary || a.diedAt !== null || a.inside !== null || a.action === 'run' || a.action === 'fight' || a.fleeing) continue;
      // Primero, si hay algún depredador suyo a la vista posible (sin nadie, ni tiradas)
      const covered = !!this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 1);
      const range = sightRange(s, night, covered);
      const around: [Animal, number][] = [];
      this.neighbours.each(a.x, a.y, range, (b, d) => {
        if (b !== a && SPECIES_DEFS[b.species].predator?.prey[s.key]) around.push([b, d]);
      });
      if (!around.length) continue;
      // Dormido casi no se entera (le despierta un ruido)
      if (a.action === 'sleep' && this.random.next() < 0.7) continue;
      let near: Animal | null = null, nearD = Infinity;
      for (const [b, d] of around) {
        const bs = SPECIES_DEFS[b.species];
        // El que acecha agachado: tirada para verlo
        if (b.hunt?.phase === 'stalk' && b.hunt.crouch) {
          if (this.random.next() >= spotChance(s, bs, d, range, a.action === 'eat')) continue;
          if (!found.has(b)) write(a, 'sawPredator', now, { predator: `@species.${bs.key}` });
          found.add(b);
        }
        if (d < nearD) {
          near = b;
          nearD = d;
        }
      }
      if (near) this.wary(a, s, near, nearD, now);
    }
    for (const w of found) this.discovered(w, now);
  }

  /** Ve a un depredador a `d` celdas: lo mira o se aparta (según su `wary` y si el otro caza) */
  private wary(a: Animal, s: SpeciesDef, b: Animal, d: number, now: number): void {
    const bs = SPECIES_DEFS[b.species];
    const w = waryOf(s, b, bs);
    if (!w || d > w.alert) return;
    const fresh = !a.signal || now - a.signal.at >= ALERT_REPEAT;
    this.face(a, b.x - a.x, b.y - a.y);
    if (fresh) {
      this.signal(a, 'alarm', now);
      write(a, d <= w.flee ? 'keepAway' : 'watching', now, { predator: `@species.${bs.key}` });
      // Avisa a los demás (pisotón, golpe, graznido): lo oyen también los de otras especies que temen al mismo
      if (this.random.next() < s.flight.alarm * 0.5) this.sound(a.x, a.y, SOUND.alarm, b.species, a, now);
    }
    if (d <= w.flee) {
      // Se aparta andando, lejos del depredador
      const dx = a.x - b.x, dy = a.y - b.y, n = Math.hypot(dx, dy) || 1;
      const x = a.x + (dx / n) * w.flee * 1.5, y = a.y + (dy / n) * w.flee * 1.5;
      if (this.walkable(Math.floor(x), Math.floor(y))) {
        a.roam = null;
        a.keepAway = { x, y, until: now + KEEP_AWAY_MINUTES };
        this.walkTo(a, x, y, now);
      }
    } else if (a.action === 'eat' || a.action === 'walk') this.setAction(a, 'idle', now);
  }

  /**
   * Un ruido en (x, y) de `volume` (SOUND): lo oye quien esté a su `hearing × volume`. Si es de un depredador (`of`),
   * solo le importa a quien teme a esa especie: se para y mira hacia allí ('?'). Oír no es ver: no sabe dónde está.
   */
  private sound(x: number, y: number, volume: number, of: number, from: Animal | null, now: number): void {
    const hs = SPECIES_DEFS[of];
    this.neighbours.each(x, y, 30 * volume, (b, d) => {
      if (b === from || b.action === 'run' || b.action === 'fight' || b.fleeing) return;
      const bs = SPECIES_DEFS[b.species];
      if (d > bs.senses.hearing * volume || !hs.predator?.prey[bs.key]) return;
      if (b.signal && now - b.signal.at < ALERT_REPEAT) return;
      this.signal(b, 'curious', now);
      this.face(b, x - b.x, y - b.y);
      if (b.action === 'eat' || b.action === 'walk' || b.action === 'sleep') this.setAction(b, 'idle', now);
      write(b, 'heardSomething', now);
    });
  }

  /** Han descubierto al que acechaba: miedo alrededor y los que acechaban esa presa pasan a perseguir */
  private discovered(w: Animal, now: number): void {
    this.huntStat(w).spotted++;
    this.sense({ type: 'predator', gx: w.x, gy: w.y, strength: 1 }, now);
    for (const h of this.stalkers) {
      if (!h.hunt || h.hunt.target !== w.hunt?.target) continue;
      h.hunt.phase = 'chase';
      h.hunt.crouch = false;
      h.hunt.since = now;
      h.order = null;
      this.startRun(h, 1, 0, now);
    }
    this.sound(w.x, w.y, SOUND.chase, w.species, w, now);
  }

  /**
   * Han cazado a uno de la manada: los suyos que lo ven (a su vista) o lo oyen (la caza se oye lejos) salen en
   * estampida, lejos de allí: cada adulto, con `herdRun.together`, con el grupo; si no, por su cuenta (y quizá no
   * encuentre después a los suyos). Las crías van con su madre.
   */
  private witnessKill(prey: Animal, hunter: Animal, now: number): void {
    const s = SPECIES_DEFS[prey.species];
    const night = !isSunHour(toGameTime(now).hour);
    const witnesses = this.members(prey.herd).filter(m => {
      if (m === prey || m.diedAt !== null || m.inside !== null || m.action === 'fight') return false;
      const d = dist(m, prey);
      return d <= sightRange(s, night, false) || d <= s.senses.hearing * SOUND.kill;
    });
    if (!witnesses.length) return;
    const base = Math.atan2(witnesses[0].y - hunter.y, witnesses[0].x - hunter.x);
    for (const m of witnesses) {
      const young = ageDays(m, now) < s.youngDays;
      const together = young || this.random.next() < s.herdRun.together;
      const side = this.random.next() < 0.5 ? 1 : -1;
      const angle = together ? base + (this.random.next() - 0.5) * 0.5 : base + side * Math.PI * (0.25 + this.random.next() * 0.4);
      write(m, 'sawKill', now, { name: prey.name }, true);
      this.frighten(m, 1, hunter.x, hunter.y, now, true, false);
      this.signal(m, 'flee', now);
      if (m.rest < RUN_MIN) continue;
      m.roam = null;
      m.strayed = together ? 0 : 1;
      this.startRun(m, Math.cos(angle), Math.sin(angle), now);
    }
  }

  /**
   * Un minuto de persecución: corre hacia la presa; al alcanzarla, intenta cazarla. Abandona si la pierde (se
   * mete en su refugio), si se agota o, pasado `giveUpAfter`, con la tirada `giveUp` cada 5 minutos.
   * Devuelve true si ya ha movido al depredador este minuto.
   */
  private chaseStep(a: Animal, s: SpeciesDef, now: number): boolean {
    const pred = s.predator!, hunt = a.hunt!;
    const prey = this.animals.find(p => p.id === hunt.target);
    const long = now - hunt.since > pred.giveUpAfter && (now - hunt.since) % 5 === 0 && this.random.next() < pred.giveUp;
    if (!prey || prey.inside !== null || a.rest < RUN_STOP || long) {
      a.hunt = null;
      // Caza fallida: con hambre, el plan B es el agua (peces)
      a.huntFailedAt = now;
      this.huntStat(a).lost++;
      if (prey && long) write(a, 'gaveUp', now);
      this.endRun(a, s, now);
      return true;
    }
    if (dist(a, prey) <= CONTACT) {
      this.startFight(a, prey, now, false);
      return true;
    }
    a.runTo = { x: prey.x, y: prey.y };
    const dx = prey.x - a.x, dy = prey.y - a.y, d = Math.hypot(dx, dy) || 1;
    a.runDx = dx / d;
    a.runDy = dy / d;
    return false;
  }

  /**
   * Cuerpo a cuerpo: el cazador alcanza a su presa (o le salta encima) y luchan unos minutos encarados (FIGHT_MINUTES,
   * por tirada), con la espada sobre los dos. Si la presa ya está luchando con otro de la manada, este se une (cuenta
   * como ayuda en la tirada). Al acabar, quien atacó primero resuelve la tirada de siempre (strike).
   */
  private startFight(a: Animal, prey: Animal, now: number, ambush: boolean): void {
    if (prey.fight) {
      // Ya luchan: se suma a la pelea como ayuda (sin pelea propia: espera a que se resuelva)
      a.fight = { with: prey.id, until: prey.fight.until, attacker: false, ambush };
    } else {
      const [lo, hi] = FIGHT_MINUTES;
      const until = now + lo + Math.floor(this.random.next() * (hi - lo + 1));
      a.fight = { with: prey.id, until, attacker: true, ambush };
      prey.fight = { with: a.id, until, attacker: false, ambush };
      this.signal(prey, 'fight', now);
      this.setAction(prey, 'fight', now);
      prey.path = null;
      prey.runTo = null;
      this.face(prey, a.x - prey.x, a.y - prey.y);
    }
    this.signal(a, 'fight', now);
    this.setAction(a, 'fight', now);
    a.path = null;
    a.runTo = null;
    this.face(a, prey.x - a.x, prey.y - a.y);
  }

  /** Luchando: quietos y encarados hasta que se acaba el tiempo; entonces quien atacó resuelve la tirada */
  private thinkFight(a: Animal, now: number): void {
    const f = a.fight;
    const other = f ? this.animals.find(o => o.id === f.with) : undefined;
    // Sin pelea o sin rival (ha muerto o se ha ido): se acaba
    if (!f || !other || (!f.attacker && now > f.until + 1)) return this.endFight(a, now);
    this.face(a, other.x - a.x, other.y - a.y);
    if (!f.attacker || now < f.until) return;
    const s = SPECIES_DEFS[a.species];
    const fighters = this.animals.filter(h => h.fight?.with === other.id || h === other);
    this.strike(a, s, other, now, f.ambush);
    for (const h of fighters) if (h.fight) this.endFight(h, now);
    // Se le ha escapado: los cazadores que siguen tras ella vuelven a perseguirla corriendo
    if (other.diedAt === null && this.animals.includes(other)) {
      for (const h of this.animals) {
        if (h.hunt?.target !== other.id || h.action === 'run') continue;
        h.hunt.phase = 'chase';
        this.startRun(h, other.x - h.x, other.y - h.y, now);
        h.runTo = { x: other.x, y: other.y };
      }
    }
    // Sigue viva y no ha hecho huir a los cazadores: se suelta y escapa herida (con la polvareda de la huida)
    if (other.diedAt === null && this.animals.includes(other) && this.animals.some(h => h.hunt?.target === other.id)) {
      other.health -= FIGHT_WOUND;
      write(other, 'escaped', now, undefined, true);
      if (other.health <= 0) return this.die(other, 'injury', now);
      this.signal(other, 'flee', now);
      other.fleeing = true;
      this.startRun(other, other.x - a.x, other.y - a.y, now);
    }
  }

  private endFight(a: Animal, now: number): void {
    a.fight = null;
    if (a.action === 'fight') this.setAction(a, 'idle', now);
  }

  /**
   * La alcanza: tirada de caza (su tipo de presa + la manada + la nieve). Una presa grande adulta puede
   * plantarse antes: entonces los depredadores se van (tirada) y alguno puede salir herido.
   */
  private strike(a: Animal, s: SpeciesDef, prey: Animal, now: number, ambush: boolean): void {
    const ps = SPECIES_DEFS[prey.species];
    const hunters = this.animals.filter(h => h.hunt?.target === prey.id);
    const helpers = hunters.filter(h => h !== a && dist(h, prey) < 4).length;
    // Plantar cara
    if (ps.defend && preyClass(prey, ps, now) === 'adult' && this.random.next() < ps.defend.stand) {
      write(prey, 'standGround', now, undefined, true);
      if (this.random.next() < ps.defend.injure) {
        a.health -= 0.3;
        write(a, 'kicked', now, undefined, true);
        if (a.health <= 0) return this.die(a, 'injury', now);
      }
      // Un grupo que sabe defenderse (humanos) puede matar al atacante: más cuantos más le ayuden
      if (ps.defend.kill) {
        const allies = this.members(prey.herd).filter(m => m !== prey && dist(m, prey) < 5 && ageDays(m, now) >= ps.youngDays).length;
        if (this.random.next() < Math.min(0.9, ps.defend.kill * (1 + allies))) {
          write(prey, 'killedAttacker', now, { name: a.name }, true);
          this.news.push({ type: 'defended', species: prey.species, attacker: a.species, name: prey.name });
          return this.die(a, 'injury', now);
        }
      }
      if (this.random.next() < ps.defend.repel) {
        for (const h of hunters) {
          h.hunt = null;
          if (h.action === 'run') this.endRun(h, SPECIES_DEFS[h.species], now);
          // Se van corriendo de la presa que les ha plantado cara
          if (h.fight) this.endFight(h, now);
          this.signal(h, 'flee', now);
          this.startRun(h, h.x - prey.x, h.y - prey.y, now);
        }
        this.news.push({ type: 'repelled', species: a.species, prey: prey.species, name: prey.name });
        return;
      }
    }
    const snow = this.conditions.snow || this.world.snowAt(Math.floor(prey.x), Math.floor(prey.y));
    const chance = catchChance(s, prey, ps, helpers, snow, now) + (ambush ? 0.15 : 0);
    if (this.random.next() >= chance) {
      this.huntStat(a).missed++;
      // Se le escapa: si acechaba, ahora persigue (la presa ya huye)
      if (ambush) {
        this.sense({ type: 'predator', gx: a.x, gy: a.y, strength: 1 }, now);
        for (const h of hunters) {
          h.hunt = { target: prey.id, phase: 'chase', since: now };
          this.startRun(h, prey.x - h.x, prey.y - h.y, now);
        }
      }
      return;
    }
    this.huntStat(a).caught++;
    if (helpers >= 2) this.huntStat(a).packCaught++;
    // Cazada: los cazadores comen de ella (la pareja dominante, la primera: los demás esperan su turno comiendo después)
    this.die(prey, 'predation', now);
    write(a, 'killed', now, { name: prey.name }, true);
    this.news.push({ type: 'killed', species: a.species, prey: prey.species, name: prey.name });
    for (const h of hunters) {
      h.hunt = null;
      if (h.action === 'run') this.endRun(h, SPECIES_DEFS[h.species], now);
      h.pantUntil = now;
      h.feeding = prey.id;
      this.setAction(h, 'eat', now);
    }
    // Se oye (y se ve): los de su manada que lo ven o lo oyen salen en estampida
    this.witnessKill(prey, a, now);
    // Llamada a la presa: la manada que caza en grupo (y comparte) acude a comer
    const herd = this.herds.get(a.herd);
    if (herd && s.predator?.shareKill) herd.feast = prey.id;
  }

  /** Come del cadáver: bocados de carne hasta llenarse o acabarlo */
  private feedOn(a: Animal, s: SpeciesDef, now: number): void {
    const c = this.corpses.find(x => x.id === a.feeding);
    if (!c || c.meat <= this.leftovers(c, s) || Math.hypot(c.x - a.x, c.y - a.y) > CONTACT * 2 || a.satiety >= FULL) {
      a.feeding = null;
      this.setAction(a, 'idle', now);
      if (c && a.satiety >= FULL) write(a, 'gorged', now);
      return;
    }
    const bite = Math.min(MEAT_BITE, c.meat);
    c.meat -= bite;
    a.satiety = Math.min(1, a.satiety + bite / s.stomach);
    this.face(a, c.x - a.x, c.y - a.y);
    // Lo que comen los goblins alimenta el suelo quemado (la Tierra Quemada crece más deprisa)
    if (s.burntBorn) this.world.feedBurnt(a.x, a.y, bite * s.burntBorn.feedsBurnt);
    // El carroñero que roba (cuervo): a veces se lleva un trozo y se aparta con él (eso es lo que pierde el lobo)
    if (s.predator?.hoard && c.meat > 0.005 && this.random.next() < s.predator.hoard) {
      const piece = Math.min(CARRY_PIECE, c.meat);
      c.meat -= piece;
      a.satiety = Math.min(1, a.satiety + (piece / s.stomach) * 0.3);
      a.feeding = null;
      write(a, 'stole', now);
      const angle = this.random.next() * Math.PI * 2;
      this.walkTo(a, a.x + Math.cos(angle) * 8, a.y + Math.sin(angle) * 8, now);
    }
  }

  /**
   * Lleva carne a las crías de la guarida. Cansa más; si se agota por el camino, otro de la manada que esté
   * cerca le releva (tirada) o, si no, se para a descansar con ella.
   */
  private carryHome(a: Animal, s: SpeciesDef, members: Animal[], herd: Herd | undefined, now: number): boolean {
    const den = this.burrows.usable(herd, now);
    if (!den) {
      a.carrying = 0;
      return false;
    }
    if (Math.hypot(a.x - den.x, a.y - den.y) <= 2) {
      // Reparte la carne entre las crías de dentro
      const pups = members.filter(m => m.inside === den.id);
      for (const p of pups) p.satiety = Math.min(1, p.satiety + a.carrying / Math.max(1, pups.length) / s.stomach * 2);
      write(a, 'feedPups', now);
      a.carrying = 0;
      return true;
    }
    if (a.rest < 0.25) {
      const mate = members.find(m => m !== a && !m.hunt && m.carrying === 0 && m.rest > 0.5 && dist(m, a) < 6 && ageDays(m, now) >= s.youngDays);
      if (mate && this.random.next() < s.predator!.carry.relay) {
        mate.carrying = a.carrying;
        a.carrying = 0;
        write(mate, 'relay', now, { name: a.name });
        this.walkTo(mate, den.x, den.y, now);
        return false;
      }
      this.setAction(a, 'sleep', now);
      return true;
    }
    this.walkTo(a, den.x, den.y, now);
    return true;
  }

  /**
   * Aullido: al anochecer (al empezar sus horas activas), cada manada aúlla con su tirada. Los despiertos y fuera
   * se paran a aullar; se oye en toda la isla (las presas se asustan, con la costumbre cada vez menos).
   */
  private howlHour(t: GameTime): void {
    const now = t.totalMinutes;
    for (const h of this.herds.values()) {
      const s = SPECIES_DEFS[h.species];
      if (!s.predator || t.hour !== s.activeHours[0][0] || this.random.next() >= s.predator.howl) continue;
      const members = this.members(h.id).filter(m => m.inside === null && m.action !== 'sleep' && m.action !== 'run' && !m.hunt);
      const leader = leaderOf(members, s, now);
      if (!leader) continue;
      for (const m of members) if (dist(m, leader) < s.herd.cohesion * 3) this.setAction(m, 'howl', now);
      write(leader, 'howl', now);
      this.news.push({ type: 'howl', species: s.id });
      this.sense({ type: 'howl', gx: leader.x, gy: leader.y, strength: 1 }, now);
    }
  }

  /**
   * Viajes de caza (una vez al día): si una manada no huele presas desde su guarida y no tiene crías dentro,
   * con su tirada se va unos días lejos (hasta `trip.islands`), duerme fuera y luego vuelve.
   */
  private planTrips(s: SpeciesDef, now: number): void {
    const pred = s.predator!;
    for (const h of this.herds.values()) {
      if (h.species !== s.id || h.trip) continue;
      const members = this.members(h.id);
      if (members.length < 2 || members.some(m => this.nursling(m, s, now))) continue;
      const c = centre(members)!;
      const range = s.senses.smell * ISLAND;
      const prey = this.animals.filter(p => pred.prey[SPECIES_DEFS[p.species].key] && Math.hypot(p.x - c.x, p.y - c.y) < range * 0.5).length;
      if (prey >= 3 || this.random.next() >= pred.trip.chance) continue;
      for (let n = 0; n < 8; n++) {
        const angle = this.random.next() * Math.PI * 2, r = pred.trip.islands * ISLAND * (0.6 + this.random.next() * 0.4);
        const x = c.x + Math.cos(angle) * r, y = c.y + Math.sin(angle) * r;
        if (!this.walkable(Math.floor(x), Math.floor(y))) continue;
        const [lo, hi] = pred.trip.days;
        h.trip = { x, y, until: now + (lo + this.random.next() * (hi - lo)) * DAY };
        this.news.push({ type: 'trip', species: s.id });
        for (const m of members) write(m, 'trip', now);
        break;
      }
    }
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
    if (this.walkable(Math.floor(a.x + ox), Math.floor(a.y + oy))) {
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
    // A quien el sol quema no le saca el hambre de día: espera a que anochezca
    const sunOut = (!!s.sunHurt && isSunHour(Math.floor((now % DAY) / 60))) || this.hibernating(s);
    if (!this.nursling(a, s, now) && !b.blocked && !sunOut && a.fear < RELAXED && (a.satiety < INSIDE_HUNGRY || a.hydration < INSIDE_HUNGRY)) return this.exit(a, now);
    if (this.hibernating(s)) {
      // Hibernando: duerme sin parar (y de vez en cuando lo cuenta en su diario)
      if (this.random.next() < 0.01) write(a, 'hibernating', now);
      return this.setAction(a, 'sleep', now);
    }
    this.setAction(a, a.rest < 0.95 ? 'sleep' : 'idle', now);
  }

  /**
   * Los que el sol quema (goblins) se ponen a cubierto desde dos horas antes del amanecer, antes que cazar o comer:
   * a su nido si lo tienen; si no, a la sombra de los árboles. Devuelve si ya se ha ocupado del animal.
   */
  private takeCover(a: Animal, s: SpeciesDef, herd: Herd | undefined, hour: number, now: number): boolean {
    const winter = this.hibernating(s);
    if (!winter && (!s.sunHurt || !(isSunHour(hour + 1) || isSunHour(hour + 2)))) return false;
    const lair = s.refuge && !a.strayed ? this.burrows.usable(herd, now) : undefined;
    const far = lair ? Math.hypot(a.x - lair.x, a.y - lair.y) : Infinity;
    // ¿Llega antes de que salga el sol? (corriendo, con lo que queda hasta el amanecer)
    const left = Math.max(0, (SUN_HOURS[0] - (hour % 24)) * 60);
    if (lair && (winter || isSunHour(hour) || far <= s.speed.run * left)) {
      if (far <= BURROW_ENTER) this.enter(a, lair, now);
      else if (far > COVER_RUN_FROM && a.rest > RUN_MIN && a.action !== 'run') {
        this.startRun(a, lair.x - a.x, lair.y - a.y, now);
        a.runTo = { x: lair.x, y: lair.y };
      } else if (a.action !== 'run') this.walkTo(a, lair.x, lair.y, now);
      return true;
    }
    const shade = this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 14);
    if (!shade) return false;
    if (Math.hypot(a.x - shade.x, a.y - shade.y) > 1) this.walkTo(a, shade.x, shade.y, now);
    else if (a.action !== 'sleep') this.setAction(a, 'sleep', now);
    return true;
  }

  /** Cría que aún no sale de la madriguera (la madre le da de mamar dentro) */
  /**
   * Cada hora: las crías de refugio cuya madre está con ellas (dentro del mismo refugio o a su lado) maman y
   * quedan apuntadas. Se mira cada hora y no una vez al día porque la madre entra y sale: lo que cuenta es que
   * venga, no dónde esté a una hora concreta.
   */
  private nurseHour(now: number): void {
    for (const k of this.animals) {
      const s = SPECIES_DEFS[k.species];
      if (!this.nursling(k, s, now)) continue;
      const mum = this.animals.find(m => m.id === k.mother && m.herd === k.herd);
      if (!mum) continue;
      // Junto a la guarida cuenta (la loba duerme a la entrada, a unas celdas de los cachorros)
      if ((k.inside !== null && mum.inside === k.inside) || Math.hypot(mum.x - k.x, mum.y - k.y) < Math.max(3, s.herd.cohesion)) {
        k.nursedAt = now;
        k.satiety = k.hydration = 1;
      }
    }
  }

  private nursling(a: Animal, s: SpeciesDef, now: number): boolean {
    const days = s.breeding.nurseDays;
    return !!days && a.mother !== null && ageDays(a, now) < days;
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
    // Los que no viven solos (lobo) encuentran a los suyos por el olfato (y el aullido) si están a su alcance:
    // una cacería larga no parte la manada
    const bed = this.herds.get(a.herd)?.bed;
    const smells = !!s.keepMin && !!bed && Math.hypot(a.x - bed.x, a.y - bed.y) <= s.senses.smell * ISLAND;
    if (smells || this.random.next() < RETURN_CHANCE) {
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
    // Un grupo de los que no viven solos que se ha quedado pequeño acoge casi siempre: le hace falta
    const small = s.keepMin && this.members(best.herd).length < s.herd.min;
    if (this.random.next() < (small ? s.keepMin!.welcome : WELCOME_CHANCE)) {
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
    this.nurseHour(now);
    const perTile = new Map<string, number>();
    const sunny = isSunHour(t.hour);
    // Población de cada especie (una vez por hora, no una vez por animal)
    const popOf = new Map<number, number>();
    for (const a of this.animals) popOf.set(a.species, (popOf.get(a.species) ?? 0) + 1);
    for (const a of [...this.animals]) {
      const s = SPECIES_DEFS[a.species];
      // Vejez (oculta: llega por sorpresa)
      if (ageDays(a, now) >= a.lifespan) {
        this.die(a, 'oldAge', now);
        continue;
      }
      // El sol quema a los que viven de noche (goblins) si les pilla fuera de su nido (a la sombra de un árbol, no)
      if (s.sunHurt && sunny && a.inside === null && !this.world.shelterNear(Math.floor(a.x), Math.floor(a.y), 1.5)) {
        a.health -= s.sunHurt;
        write(a, 'sunburnt', now);
        if (a.health <= 0) {
          this.die(a, 'sun', now);
          continue;
        }
      }
      // Frío y calor: fuera de su franja acumula exposición; pasado 1, hipotermia o golpe de calor
      if (this.exposure(a, s, now)) continue;
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
      const pop = popOf.get(s.id) ?? 0;
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
    this.howlHour(t);
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
      // Las crías no cuentan: una camada no parte la manada (la madre se iría con ellas lejos de la guarida y morirían)
      const grown = members.filter(m => ageDays(m, now) >= s.youngDays).length;
      if (grown <= s.herd.max || this.nestsFull(s)) continue;
      const leaving = splitOff(members, s, now);
      if (!leaving.length) continue;
      const angle = this.random.next() * Math.PI * 2;
      const nh = this.newHerd(h.species, h.tx + Math.cos(angle) * 8, h.ty + Math.sin(angle) * 8);
      for (const m of leaving) m.herd = nh.id;
      this.news.push({ type: 'herdSplit', species: h.species });
      // Isla llena: los que se separan no encuentran sitio y se van de la isla
      if (this.islandFull(s)) this.startLeaving(nh, s, now);
    }
  }

  /**
   * Madrigueras, cada hora (todo por tiradas de la especie): los de dentro salen al acabar sus horas de dormir, a
   * veces salen a tomar el sol, con lluvia se quedan; si se inunda, salen a tiempo o se ahogan; si está tapada,
   * la destapan.
   */
  private refugeHour(t: GameTime): void {
    const now = t.totalMinutes, c = this.conditions;
    // El terreno: la arena o el humus que se asientan en una entrada la tapan y, con tiempo, la hunden
    for (const h of this.burrows.cover()) this.burrowHit(h, now);
    const told = new Set<number>();
    for (const a of [...this.animals]) {
      const s = SPECIES_DEFS[a.species], r = s.refuge;
      if (!r || a.inside === null) continue;
      const b = this.burrows.get(a.inside);
      if (!b) {
        this.exit(a, now);
        continue;
      }
      // Refugio helado (Escarcha): no salen y, a los que les hace daño el frío (goblins), se les apaga la brasa
      if (this.world.frozenAt(b.x, b.y)) {
        if (s.frostHurt) {
          a.health -= s.frostHurt;
          write(a, 'frozenIn', now);
          if (a.health <= 0) this.die(a, 'frost', now);
        }
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
          this.burrows.unblock(b);
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
          // Con poca presa para tantos (lobo: densidad por encima de `scarceAbove`), camadas más pequeñas
          const scarce = density > (b.scarceAbove ?? Infinity);
          const male = tryConceive(f, this.members(f.herd), s, now, t.year, 1, this.random, scarce);
          if (male) write(f, 'rut', now, { name: male.name });
        }
      }
      if (b.mode === 'season' && b.seasons.includes(t.season)) {
        for (const f of all) {
          // Con tope de nidos (goblins), un nido lleno no cría: no caben más
          if (s.burntBorn && this.members(f.herd).length >= s.herd.max) continue;
          const male = tryConceiveSeason(f, this.members(f.herd), s, now, density > CROWDED, this.random);
          if (male) write(f, 'mated', now, { name: male.name });
        }
      }
      for (const f of all) if (f.dueAt !== null && f.dueAt <= now) this.giveBirth(f, s, now);
      // Crías de refugio: si su madre no ha pasado a darles de mamar en todo el día, pueden no salir adelante
      // (las visitas se apuntan cada hora en nurseHour: la madre sale a comer y vuelve)
      if (b.nurseDays) {
        for (const k of all) {
          if (!this.nursling(k, s, now) || now - k.nursedAt < DAY) continue;
          if (this.random.next() < (b.orphanDeath ?? 0)) this.die(k, 'orphaned', now);
        }
      }
      // Depredadores: con poca presa cerca de la guarida (y sin crías que cuidar), se van de viaje de caza
      if (s.predator) this.planTrips(s, now);
      // Manada de depredadores más grande de lo que dan las presas: los jóvenes se van antes a buscar territorio
      if (s.predator?.shareKill) this.packToPrey(s, capacity, now);
      // Solos que no encuentran grupo: pasados unos días se van de la isla en vez de morir de hambre solos
      if (s.keepMin) this.lonesLeave(all, s, now);
      // Jóvenes que se hacen adultos: algunos se van a fundar su propia manada
      if (s.dispersal) {
        for (const a of all) {
          const age = ageDays(a, now);
          if (age < s.adultDays || age >= s.adultDays + 1 || this.members(a.herd).length < 2 || this.nestsFull(s)) continue;
          // Los que no viven solos no dejan a su grupo por debajo del mínimo
          if (s.keepMin && this.members(a.herd).filter(m => ageDays(m, now) >= s.youngDays).length <= s.herd.min) continue;
          if (this.random.next() >= s.dispersal[a.sex]) continue;
          this.disperse(a, s, now);
        }
      }
      // Enfermedad: brota con superpoblación
      const largest = Math.max(0, ...this.groupsOf(s.id).map(h => this.members(h.id).length));
      const crowd = crowding(s, density, largest, this.groupsOf(s.id).length, this.world.islandArea());
      const zero = outbreak(all, s, crowd, this.random);
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
    this.migrate(t);
  }

  // ── Llegadas y marchas ──

  /**
   * Una vez al día: las manadas con hambre de verdad pueden irse de la isla (tirada). Cada MIGRATION_EVERY_DAYS,
   * si caben más grupos (tope tirado), puede llegar uno por la orilla, de la especie que tenga sitio (tirada por
   * especie, en orden al azar; como mucho uno). Un depredador solo tiene sitio si hay presas.
   */
  private migrate(t: GameTime): void {
    const now = t.totalMinutes;
    // Cuándo se vio por última vez cada especie (para que una que desaparece tarde en volver)
    for (const a of this.animals) this.lastSeen.set(a.species, now);
    // Hambre de verdad (cada día): la manada puede irse de la isla (solo las especies que lo hacen: el depredador)
    for (const h of [...this.herds.values()]) {
      const s = SPECIES_DEFS[h.species];
      if (h.leaving || !s.migration?.hungryLeave) continue;
      const adults = this.members(h.id).filter(a => ageDays(a, now) >= s.youngDays);
      if (!adults.length) continue;
      const satiety = adults.reduce((sum, a) => sum + a.satiety, 0) / adults.length;
      const health = adults.reduce((sum, a) => sum + a.health, 0) / adults.length;
      // Días seguidos con hambre de verdad: solo pasados `hungryDays` puede irse
      const days = satiety < LEAVE_HUNGRY_BELOW ? (this.hungryDays.get(h.id) ?? 0) + 1 : 0;
      this.hungryDays.set(h.id, days);
      if (days < (s.migration.hungryDays ?? 1)) continue;
      if (this.random.next() < leaveChance(s, satiety, health)) this.startLeaving(h, s, now);
    }
    if (t.day % MIGRATION_EVERY_DAYS !== 0) return;
    const chunks = this.world.islandArea();
    // Especies de más (por encima de su tope): uno de sus grupos puede irse (premia al jugador que equilibra)
    for (const s of SPECIES_DEFS) {
      const own = this.groupsOf(s.id);
      if (own.length && this.random.next() < crowdLeaveChance(s, own.length, chunks)) {
        this.startLeaving(own[Math.floor(this.random.next() * own.length)], s, now);
      }
    }
    // Llegadas: como mucho una cada vez, de una especie con sitio (en orden al azar)
    if (this.groupCount() >= groupsCap(chunks, this.random)) return;
    const carrion = this.corpses.some(c => c.meat > 0.005);
    const order = SPECIES_DEFS.filter(s => s.migration).sort(() => this.random.next() - 0.5);
    for (const s of order) {
      const seen = this.lastSeen.get(s.id);
      const chance = arrivalChance(s, {
        population: this.animals.filter(a => a.species === s.id).length,
        capacity: this.capacity.get(s.id) ?? 0,
        groups: this.groupsOf(s.id).length,
        groupSize: (s.migration?.founders ?? s.founders ?? FOUNDERS).length + mid(s.migration?.extraYoung) + mid(s.migration?.extraAdults),
        cap: speciesCap(s, chunks, this.random),
        absentDays: seen === undefined ? Infinity : (now - seen) / DAY,
        carrion,
      });
      if (this.random.next() >= chance) continue;
      const at = this.world.shore(this.random);
      if (!at) return;
      // Quiénes llegan: los de su llegada natural (o sus fundadores) y, por tirada, más jóvenes y más adultos:
      // cada grupo que llega es distinto
      this.spawnHerd(s.key, at.x, at.y, now, false, this.arrivers(s), true);
      return;
    }
  }

  /** Quiénes llegan en un grupo nuevo de la especie: su base y, por tirada, jóvenes y adultos de más */
  private arrivers(s: SpeciesDef): { sex: Sex; age: 'adult' | 'young' }[] {
    const m = s.migration;
    const base = [...(m?.founders ?? s.founders ?? FOUNDERS)];
    const roll = (r?: readonly [number, number]) => (r ? r[0] + Math.floor(this.random.next() * (r[1] - r[0] + 1)) : 0);
    const sex = (): Sex => (this.random.next() < 0.5 ? 'female' : 'male');
    for (let n = roll(m?.extraAdults); n > 0; n--) base.push({ sex: sex(), age: 'adult' });
    for (let n = roll(m?.extraYoung); n > 0; n--) base.push({ sex: sex(), age: 'young' });
    return base;
  }

  /** La manada se va de la isla: hacia la orilla más cercana de unas cuantas (sale de su refugio; las crías, con ella) */
  private startLeaving(h: Herd, s: SpeciesDef, now: number): void {
    const members = this.members(h.id);
    const c = centre(members) ?? { x: members[0]?.x ?? 0, y: members[0]?.y ?? 0 };
    let best: { x: number; y: number } | null = null;
    for (let n = 0; n < 6; n++) {
      const p = this.world.shore(this.random);
      if (p && (!best || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(best.x - c.x, best.y - c.y))) best = p;
    }
    if (!best) return;
    // Uno solo (un joven que no encuentra sitio) se va sin noticia en la crónica: solo lo cuenta su diario
    const quiet = members.length < 2;
    h.leaving = { x: best.x, y: best.y, until: now + LEAVE_HOURS * 60, quiet };
    h.trip = null;
    for (const a of members) {
      if (a.inside !== null) this.exit(a, now);
      a.hunt = null;
      a.roam = null;
      a.order = null;
      write(a, 'leaving', now, undefined, true);
    }
    if (!quiet) this.news.push({ type: 'leaving', species: s.id, count: members.length });
  }

  /** De camino a la orilla para irse: anda hacia allí y, al llegar (o pasado el plazo), deja la isla */
  private thinkLeaving(a: Animal, h: Herd, now: number): void {
    const l = h.leaving!;
    if (now >= l.until || Math.hypot(a.x - l.x, a.y - l.y) < 2) return this.depart(a, now);
    const [ox, oy] = this.offset(a.id, 1.5);
    if (a.action !== 'walk' || Math.hypot(a.tx - l.x - ox, a.ty - l.y - oy) > 1) this.walkTo(a, l.x + ox, l.y + oy, now);
  }

  /** Deja la isla: no muere, se va (no deja cadáver) */
  private depart(a: Animal, now: number): void {
    const i = this.animals.indexOf(a);
    if (i < 0) return;
    this.animals.splice(i, 1);
    a.action = 'idle';
    a.actionSince = now;
    if (!this.members(a.herd).length) {
      const quiet = this.herds.get(a.herd)?.leaving?.quiet;
      this.herds.delete(a.herd);
      if (!quiet) this.news.push({ type: 'left', species: a.species });
    }
  }

  private giveBirth(mother: Animal, s: SpeciesDef, now: number): void {
    const kids: Animal[] = [];
    for (let n = 0; n < mother.litter; n++) {
      const sex: Sex = this.random.next() < 0.5 ? 'male' : 'female';
      const kid = this.create(s, sex, now, mother.x + (this.random.next() - 0.5), mother.y + (this.random.next() - 0.5), mother.herd, mother, now);
      kid.satiety = 0.7;
      // Si la madre está en la madriguera, nacen dentro; si su especie cría en guarida (lobo), en la guarida de
      // la manada (y ahí se quedan sus primeros días)
      const den = mother.inside !== null ? this.burrows.get(mother.inside) : s.breeding.nurseDays ? this.burrows.usable(this.herds.get(mother.herd), now) : undefined;
      if (den) {
        kid.inside = den.id;
        kid.x = kid.tx = den.x;
        kid.y = kid.ty = den.y;
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
      if (!this.walkable(Math.floor(x), Math.floor(y))) continue;
      this.walkTo(a, x, y, now);
      break;
    }
    write(a, 'leaveHome', now, undefined, true);
    this.news.push({ type: 'dispersed', species: s.id, name: a.name });
    // Isla llena (no caben más grupos): no encuentra dónde fundar el suyo y se va de la isla, como los jóvenes
    // de verdad cuando todos los territorios están ocupados
    if (this.islandFull(s)) this.startLeaving(this.herds.get(a.herd)!, s, now);
  }

  /** Grupos (de 2 o más) que hay en la isla, sin contar los que se están yendo */
  private groupCount(): number {
    let n = 0;
    for (const h of this.herds.values()) if (!h.leaving && this.members(h.id).length >= 2) n++;
    return n;
  }

  /** Grupos (de 2 o más) de una especie, sin contar los que se están yendo */
  private groupsOf(species: number): Herd[] {
    return [...this.herds.values()].filter(h => h.species === species && !h.leaving && this.members(h.id).length >= 2);
  }

  /**
   * ¿Está la isla llena para un grupo nuevo de esta especie? Llena de grupos en general o de los suyos (los dos
   * topes se tiran cada vez: unas veces cabe uno más y otras no).
   */
  /**
   * Una hora de frío o calor: la temperatura de su celda, con el abrigo del refugio, de dormir apiñado con los suyos o
   * el fresco de la sombra. Fuera de su franja acumula exposición (más cuanto más se sale); dentro, se recupera.
   * Desde 1 pierde vida cada hora (hipotermia, golpe de calor). Devuelve si ha muerto.
   */
  private exposure(a: Animal, s: SpeciesDef, now: number): boolean {
    const gx = Math.floor(a.x), gy = Math.floor(a.y);
    const t = this.world.temperature(gx, gy);
    const [lo, hi] = s.comfort;
    // El abrigo y la sombra solo se miran cuando hacen falta (es caro mirar los árboles y la manada de cada animal)
    let warm = 0, shade = 0;
    if (a.inside !== null) warm += REFUGE_WARMTH;
    else if (t < lo && a.action === 'sleep' && this.members(a.herd).filter(m => m !== a && dist(m, a) < s.herd.cohesion).length >= 2) warm += HUDDLE_WARMTH;
    if (t > hi && a.inside === null && this.world.shelterNear(gx, gy, 1.5)) shade = SHADE_COOL;
    const below = lo - (t + warm), above = (t - shade) - hi;
    // Por cada 0,1 que se sale, EXPOSURE_RATE / 10 por hora
    a.cold = below > 0 ? a.cold + below * EXPOSURE_RATE : Math.max(0, a.cold - EXPOSURE_RECOVER);
    a.heat = above > 0 ? a.heat + above * EXPOSURE_RATE : Math.max(0, a.heat - EXPOSURE_RECOVER);
    if (a.cold >= 1 || a.heat >= 1) {
      const cold = a.cold >= a.heat;
      a.health -= EXPOSURE_DAMAGE;
      write(a, cold ? 'freezing' : 'overheated', now);
      if (a.health <= 0) {
        this.die(a, cold ? 'frost' : 'heat', now);
        return true;
      }
    }
    return false;
  }

  /**
   * Frío: a su refugio si lo tiene; si no, junto a los suyos (de noche se apiñan). Calor: a la sombra de los árboles.
   * Devuelve si se ha ocupado del animal.
   */
  private seekComfort(a: Animal, s: SpeciesDef, herd: Herd | undefined, members: Animal[], now: number): boolean {
    if (a.cold >= EXPOSURE_SEEK && a.cold >= a.heat) {
      const home = s.refuge && !a.strayed ? this.burrows.usable(herd, now) : undefined;
      if (home && (s.refuge!.adultsInside || ageDays(a, now) < s.youngDays)) {
        if (Math.hypot(a.x - home.x, a.y - home.y) <= BURROW_ENTER) this.enter(a, home, now);
        else this.walkTo(a, home.x, home.y, now);
        return true;
      }
      const leader = leaderOf(members, s, now);
      if (leader && leader !== a && dist(a, leader) > s.herd.cohesion) {
        this.walkTo(a, leader.x, leader.y, now);
        return true;
      }
      return false;
    }
    if (a.heat >= EXPOSURE_SEEK) {
      if (this.toShelter(a, s, now, 14)) return true;
      if (a.action !== 'idle' && a.action !== 'sleep') this.setAction(a, 'idle', now);
      return a.heat >= 1;
    }
    return false;
  }

  /** ¿Hiberna ahora? (su estación de hibernar: el invierno, para los goblins) */
  private hibernating(s: SpeciesDef): boolean {
    return !!s.hibernate && this.conditions.cold;
  }

  /**
   * Tamaño de manada según las presas (lobo): lo que la isla puede alimentar de su especie, repartido entre sus
   * manadas (al menos la pareja, como mucho herd.max). Si una manada se pasa, cada día se va uno de sus jóvenes ya
   * destetados (el más joven de los que ya no son crías), a fundar la suya o, sin sitio ni presas, fuera de la isla.
   */
  private packToPrey(s: SpeciesDef, capacity: number, now: number): void {
    const herds = this.groupsOf(s.id);
    if (!herds.length) return;
    // Nunca por debajo de su mínimo (`keepMin`: 3 lobos); con pocas presas pasan hambre juntos
    const limit = Math.max(s.keepMin ? s.herd.min : 2, Math.min(s.herd.max, Math.floor(capacity / herds.length)));
    for (const h of herds) {
      const members = this.members(h.id);
      // Cuentan los destetados: las crías aún no cazan (y si se fuera un adulto por ellas, se quedarían sin quien las cuide)
      if (members.filter(m => ageDays(m, now) >= s.youngDays).length <= limit) continue;
      const leader = leaderOf(members, s, now);
      const young = members
        .filter(m => m !== leader && m.dueAt === null && ageDays(m, now) >= s.youngDays && m.inside === null)
        .sort((a, b) => b.bornAt - a.bornAt)[0];
      if (!young) continue;
      this.disperse(young, s, now);
      // Sin presas para uno más en toda la isla: no se queda a cazar solo, se va de la isla
      const herd = this.herds.get(young.herd);
      if (herd && !herd.leaving && this.animals.filter(a => a.species === s.id).length > capacity) this.startLeaving(herd, s, now);
    }
  }

  /**
   * El grupo pequeño de los suyos (de menos de `herd.min`, también otro solitario) más cercano a su olfato
   * (`keepMin.seekIslands`): adonde va un solitario de especie que no vive sola. Así se forman manadas nuevas.
   */
  private smallPackNear(a: Animal, s: SpeciesDef): { x: number; y: number } | null {
    if (!s.keepMin || a.inside !== null || this.herds.get(a.herd)?.leaving) return null;
    let best: { x: number; y: number; d: number } | null = null;
    for (const h of this.herds.values()) {
      if (h.id === a.herd || h.id === a.leftHerd || h.species !== a.species || h.leaving) continue;
      const members = this.members(h.id);
      if (!members.length || members.length >= s.herd.min) continue;
      const c = centre(members)!;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d <= s.keepMin.seekIslands * ISLAND && (!best || d < best.d)) best = { x: c.x, y: c.y, d };
    }
    return best;
  }

  /** Una vez al día: el adulto que lleva `keepMin.loneLeaveDays` solo puede irse de la isla (tirada `loneLeave`) */
  private lonesLeave(all: Animal[], s: SpeciesDef, now: number): void {
    const k = s.keepMin!;
    for (const a of all) {
      const h = this.herds.get(a.herd);
      if (!h || h.leaving || this.members(h.id).length > 1 || ageDays(a, now) < s.youngDays) {
        this.loneSince.delete(a.id);
        continue;
      }
      const since = this.loneSince.get(a.id);
      if (since === undefined) this.loneSince.set(a.id, now);
      else if ((now - since) / DAY >= k.loneLeaveDays && this.random.next() < k.loneLeave) {
        this.loneSince.delete(a.id);
        this.startLeaving(h, s, now);
      }
    }
  }

  /** ¿Tiene ya la isla todos los nidos que caben de esta especie? (goblins: `burntBorn.maxNests`) */
  nestsFull(s: SpeciesDef): boolean {
    const max = s.burntBorn?.maxNests;
    if (!max) return false;
    let n = 0;
    for (const h of this.herds.values()) if (h.species === s.id && this.members(h.id).length > 0) n++;
    return n >= max;
  }

  private islandFull(s: SpeciesDef): boolean {
    const chunks = this.world.islandArea();
    if (chunks <= 0) return false;
    return this.groupCount() >= groupsCap(chunks, this.random) || (!!s.migration && this.groupsOf(s.id).length >= speciesCap(s, chunks, this.random));
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
      inside: null, outUntil: 0, frozenUntil: 0, runTo: null, sickUntil: null, immune: false, leftHerd: null, lateBy: 0, lateFor: -1, nursedAt: now, search: null, waterGoal: null, badWater: [],
      hunt: null, fight: null, cold: 0, heat: 0, carrying: 0, fishing: null, keepAway: null, huntFailedAt: -Infinity, feeding: null, meat: 0, meatFull: 0,
      runDx: 0, runDy: 0, runX: x, runY: y, dueAt: null, litter: 0, lastRutYear: -1, seeds: [], diary: [], diaryDay: -1,
      diaryToday: 0, diedAt: null, cause: null,
    };
    write(a, 'born', now, undefined, true);
    this.animals.push(a);
    return a;
  }

  private die(a: Animal, cause: DeathCause, now: number): void {
    this.loneSince.delete(a.id);
    const i = this.animals.indexOf(a);
    if (i < 0) return;
    this.animals.splice(i, 1);
    a.diedAt = now;
    a.cause = cause;
    a.dueAt = null;
    a.order = null;
    a.action = 'dead';
    a.actionSince = now;
    a.hunt = null;
    a.feeding = null;
    // Su cuerpo es comida para los carnívoros (carroña)
    a.meat = a.meatFull = MEAT_BY_SIZE[SPECIES_DEFS[a.species].size] * (ageDays(a, now) < SPECIES_DEFS[a.species].youngDays ? 0.4 : 1);
    a.fight = null;
    this.corpses.push(a);
    this.news.push({ type: 'died', species: a.species, name: a.name, cause });
    if (!this.members(a.herd).length) this.herds.delete(a.herd);
    // Los demás notan el cuerpo (lo evitan; su madre no se separa de él)
    this.sense({ type: 'corpse', gx: a.x, gy: a.y, strength: 0.6, animal: a.id }, now);
  }

  private newHerd(species: number, x: number, y: number): Herd {
    const h: Herd = { id: this.nextHerd++, species, tx: x, ty: y, avoid: new Set(), habit: new Map(), zones: [], bed: null, burrow: null, trip: null, water: [], food: [], kills: [], feast: null, leaving: null };
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
    // Hibernando en su refugio apenas gasta
    if (a.inside !== null && this.hibernating(s)) return { hunger: s.hibernate!.needs, thirst: s.hibernate!.needs, rest };
    return { hunger: c.cold ? s.winterAppetite ?? 1 : 1, thirst: (c.hot ? 1.3 : 1) * (c.drought ? 1.2 : 1), rest };
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
  /** Especies que son presa de algún depredador (para los que viven de sus restos) */
  private readonly preyOfSomeone = new Set(SPECIES_DEFS.flatMap(d => Object.keys(d.predator?.prey ?? {})));

  private refreshCapacity(now: number, season: SeasonId): void {
    for (const s of SPECIES_DEFS) {
      const daily = s.stomach * s.hungerPerDay;
      if (s.predator) {
        // Un depredador vive de sus presas: la carne que hay en pie (repartida en el tiempo que tardan en reponerse)
        let meat = 0;
        const bones = !!s.predator.bones;
        for (const p of this.animals) {
          const ps = SPECIES_DEFS[p.species];
          if (s.predator.prey[ps.key]) meat += MEAT_BY_SIZE[ps.size] * PREY_TURNOVER;
          // Quien pica los huesos (cuervo) vive también de lo que cazan otros: los restos de cada animal que es presa
          // de alguien (conejos incluidos: también les queda carne en los huesos). Los restos no se reponen como las
          // presas: cada animal que caza otro acaba dejando sus huesos, así que cuentan enteros
          else if (bones && this.preyOfSomeone.has(ps.key)) meat += MEAT_BY_SIZE[ps.size] * SCAVENGE_SHARE;
        }
        // La carroña que hay ahora (para quien no pica los huesos, sin los restos)
        if (s.predator.carrion > 0.5) for (const c of this.corpses) meat += Math.max(0, c.meat - this.leftovers(c, s));
        // Y si come fruta casi siempre (cuervo), lo que da la vegetación
        const plants = (s.predator.plantsBelow ?? 0) >= 0.5 ? this.world.totalFood(s.diets, now, season) / CHUNKS_PER_PLOT : 0;
        this.capacity.set(s.id, (meat + plants) / (daily * CAPACITY_DAYS));
        continue;
      }
      // La comida de la isla se cuenta por parcela: en una isla más grande caben los mismos animales, más separados
      this.capacity.set(s.id, this.world.totalFood(s.diets, now, season) / CHUNKS_PER_PLOT / (daily * CAPACITY_DAYS));
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
/** Minutos que dura un aullido */
const HOWL_MINUTES = 8;
/** Parte de la carne de las presas que un depredador puede cazar sin acabar con ellas [PROPUESTA] */
const PREY_TURNOVER = 0.25;
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
