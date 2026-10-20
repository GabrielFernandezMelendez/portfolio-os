import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { SandworldLang, SimSpeed, SIM_SPEEDS } from './domain/models/settings.model';
import { GameTime } from './domain/models/time.model';
import { GameEvents } from './domain/events/game-events';
import { ChronicleDraft, ChronicleEntry } from './domain/models/chronicle.model';
import { SAND_ORDER, SandId } from './domain/models/sand.model';
import { EventBus } from './application/events/event-bus';
import { TimeEngine } from './application/time/time-engine';
import { Chronicle } from './application/chronicle/chronicle';
import { IndicatorRegistry, IndicatorValue } from './application/indicators/indicator-registry';
import { registerWorldIndicators } from './application/indicators/world-indicators';
import { World } from './application/world/world';
import { nextChunkToReveal } from './application/world/expansion';
import { TerrainPhysics } from './application/physics/terrain-physics';
import { Material } from './domain/models/material.model';
import { WORLD } from './domain/models/world.model';
import { ChunkCoord } from './domain/events/game-events';
import { PourQueue, SettledPour } from './application/sands/pour-queue';
import { Stroke } from './application/sands/stroke';
import { SAND_EFFECTS } from './application/sands/sand-effects';
import { SeededRandom } from './infrastructure/seeded-random';
import { BiomeSystem } from './application/world/biomes';
import { BIOME_BY_ID, BIOME_CHECK_MINUTES } from './config/biomes.config';
import { WeatherNews, WeatherSystem } from './application/climate/weather';
import { CLEAR_WEATHER, WeatherState } from './domain/models/weather.model';
import { Biome, BiomeId } from './domain/models/biome.model';
import { ChunkData, cellIndex, tileIndex } from './domain/models/chunk.model';
import type { TappedTile } from './sandworld-runtime';
import { Season } from './domain/models/time.model';
import { DevTileView } from './rendering/dev/dev-tile-overlay';
import { DevAction } from './config/dev.config';
import { VegetationSystem } from './application/vegetation/vegetation';
import { eatFruit, plantDevFlags } from './application/vegetation/plant-layout';
import { PLANT_DEFS, VEGETATION_CHECK_MINUTES } from './config/plants.config';
import { SAND_COLOR_NUM } from './config/sands.config';
import { PENDING_REDRAW_MINUTES } from './config/pour.config';
import { Translator } from './i18n/translator';
import { SETTINGS_STORAGE } from './infrastructure/settings-storage.token';
import { DEFAULT_SEED } from './config/world.config';
import { FaunaNews, FaunaSystem } from './application/fauna/fauna-system';
import { FaunaWorldAdapter } from './application/fauna/fauna-world-adapter';
import { AnimalOrder } from './domain/models/animal.model';
import { SPECIES_DEFS } from './config/species.config';
import { AnimalView, animalView } from './application/fauna/animal-view';

/** El reloj de la interfaz avanza de 10 en 10 minutos de juego, como en Stardew */
const CLOCK_STEP_MINUTES = 10;
/** Milisegundos que se ve el nombre del bioma al tocar un tile */
const INSPECT_MS = 2500;
/** Agua (en niveles) en la celda tocada a partir de la que la etiqueta dice "Agua" */
const INSPECT_WATER = 0.05;
/** Cada cuántos minutos de juego se refresca la ficha del animal elegido */
const ANIMAL_VIEW_MINUTES = 5;
/** Segundos que se ve la etiqueta "Isla viva · Nivel N" */
const ISLAND_LABEL_MS = 3000;

/** Id del panel abierto: el de una tabla del estante (ver ui/organisms/hud/hud-planks.ts) */
export type HudPanel = string;
export type HudMenu = 'settings' | 'chronicle';

/**
 * Estado de la partida que necesita la interfaz y raíz de composición de la lógica.
 * Se provee en el componente raíz (no en 'root'): nace al abrir el juego y muere al cerrarlo.
 * El estado del mundo (celdas, agua, animales) NO va en signals: vive en arrays tipados del dominio.
 */
@Injectable()
export class SandworldService implements OnDestroy {
  private readonly translator = inject(Translator);
  private readonly storage = inject(SETTINGS_STORAGE);

  // ── Lógica de la partida ──
  readonly world = new World(DEFAULT_SEED);
  readonly events = new EventBus<GameEvents>();
  readonly engine = new TimeEngine(this.events);
  readonly chronicle = new Chronicle();
  readonly indicators = new IndicatorRegistry();
  /** Física del terreno: avanza con cada minuto de juego (se para en pausa, acelera a x2/x4) */
  readonly physics = new TerrainPhysics(this.world);
  /** Vertidos asentándose (cada uno tarda 1–2 días de juego) */
  readonly pours = new PourQueue(this.physics, new SeededRandom(this.world.seed * 7919 + 13));
  /** Biomas vivos: cambian con el estado del terreno; el Claro Despierto nace raro y crece despacio */
  readonly biomes = new BiomeSystem(this.world, new SeededRandom(this.world.seed * 104729 + 7));
  /** Vegetación por tile: crece, compite, se extiende y se entierra */
  readonly vegetation = new VegetationSystem(this.world, new SeededRandom(this.world.seed * 6151 + 11));
  /** Tiempo atmosférico: lluvia (o nieve), repartida al azar en cada estación según el registro de fenómenos */
  readonly weatherSystem = new WeatherSystem(this.physics, new SeededRandom(this.world.seed * 7907 + 3));
  /** El mundo visto por la fauna (adaptador del puerto FaunaWorld) */
  readonly faunaWorld = new FaunaWorldAdapter(this.world, this.vegetation);
  /** Fauna: animales, manadas, celo y partos (bloque C: ciervos) */
  readonly fauna = new FaunaSystem(this.faunaWorld, new SeededRandom(this.world.seed * 2903 + 19));
  /** Trazo en curso mientras el dedo vierte */
  private stroke: Stroke | null = null;

  // ── Estado para la interfaz ──
  readonly lang = this.translator.lang.asReadonly();
  readonly speed = signal<SimSpeed>(1);
  /** Pausa elegida por el jugador (los menús pausan aparte, sin tocar esta) */
  readonly isPaused = signal(false);
  readonly isReady = signal(false);
  readonly time = signal<GameTime>(this.engine.time);
  readonly panel = signal<HudPanel | null>(null);
  readonly menu = signal<HudMenu | null>(null);
  readonly selectedSand = signal<SandId | null>(null);
  /** Libro de la crónica (todo, en orden de tiempo de juego) */
  readonly chronicleEntries = signal<readonly ChronicleEntry[]>([]);
  /** Franja de arriba (con ritmo: lo que va saliendo de la cola) */
  readonly chronicleStrip = signal<readonly ChronicleEntry[]>([]);
  readonly indicatorValues = signal<readonly IndicatorValue[]>([]);
  readonly islandLabel = signal(false);
  /** Modo desarrollo: capa de esencia y afinidad o de biomas sobre la isla (null = ninguna) */
  readonly devView = signal<DevTileView | null>(null);
  /** El tiempo que hace (la placa de la hora muestra su icono) */
  readonly weather = signal<WeatherState>(CLEAR_WEATHER);
  /**
   * Tile tocado sin arena: qué es (bioma, o agua) y dónde enseñarlo. Es una lista de 0 o 1 elementos con un id
   * nuevo en cada toque: así la etiqueta se vuelve a crear (y a animar) aunque se toque el mismo tile seguido.
   */
  readonly inspected = signal<readonly { readonly id: number; readonly labelKey: string; readonly x: number; readonly y: number }[]>([]);
  private inspectId = 0;
  private inspectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Animal elegido (tocado en el mapa): su ficha sale abajo. Su foto se refresca cada pocos minutos de juego. */
  readonly selectedAnimal = signal<number | null>(null);
  readonly animalView = signal<AnimalView | null>(null);
  /** Lo que le queda al trazo en curso (1 = botella llena). La botella del estante lo muestra. */
  readonly strokeLeft = signal(1);

  private chronicleRevision = -1;
  private islandLabelTimer: ReturnType<typeof setTimeout> | null = null;
  private hasStoredLang = false;

  constructor() {
    const stored = this.storage.load();
    if (stored.lang) {
      this.translator.setLang(stored.lang);
      this.hasStoredLang = true;
    }

    // Generar el chunk inicial antes de registrar indicadores que lo leen
    this.world.chunk(0, 0);
    registerWorldIndicators(this.indicators, this.world);
    this.refreshIndicators();

    this.events.on('minute', t => {
      if (t.minute % CLOCK_STEP_MINUTES === 0) this.time.set(t);
    });
    this.events.on('hour', () => this.refreshIndicators());
    this.events.on('minute', t => {
      this.physics.climate.update(t);
      this.reportWeather(this.weatherSystem.minute(t));
      const w = this.weatherSystem.current;
      this.physics.fire.conditions.season = t.season;
      this.physics.fire.conditions.droughtDays = this.weatherSystem.droughtDays(t.totalMinutes);
      this.physics.fire.conditions.rain = w.look !== 'none' ? w.intensity : 0;
      const changed = this.physics.minute();
      this.reportFire();
      if (changed.length) this.events.emit('terrainChanged', changed);
      this.settlePours(t.minute);
      this.reportWorldEvents();
      if (t.minute % BIOME_CHECK_MINUTES === 0) this.updateBiomes();
      if (t.minute % VEGETATION_CHECK_MINUTES === 0) this.updateVegetation(t.season);
      this.fauna.minute(t);
      this.reportFauna();
      if (this.selectedAnimal() !== null && t.minute % ANIMAL_VIEW_MINUTES === 0) this.refreshAnimal();
      if (t.minute === 0) {
        const grazed = this.faunaWorld.takeChanges();
        if (grazed.length) this.events.emit('vegetationChanged', grazed);
      }
    });
    this.events.on('newSeason', t => {
      this.biomes.newSeason();
      this.weatherSystem.planSeason(t.season, t.totalMinutes);
      if (t.season === Season.SPRING) this.log({ type: 'world', key: 'chronicle.thaw', priority: 5 });
    });
    this.events.on('dawn', () => this.log({ type: 'time', key: 'chronicle.dawn' }));
    this.events.on('dusk', () => this.log({ type: 'time', key: 'chronicle.dusk' }));
    this.events.on('newDay', t => this.log({ type: 'time', key: 'chronicle.newDay', params: { day: t.day } }));
    this.events.on('newSeason', t => this.log({ type: 'world', key: `chronicle.newSeason.${t.season}`, priority: 5 }));
  }

  ngOnDestroy(): void {
    this.events.clear();
    if (this.islandLabelTimer) clearTimeout(this.islandLabelTimer);
    if (this.inspectTimer) clearTimeout(this.inspectTimer);
  }

  /** Llamar cuando el mundo ya se ve en pantalla */
  start(): void {
    this.isReady.set(true);
    this.log({ type: 'world', key: 'chronicle.start', priority: 10 });
    this.showIslandLabel();
  }

  /** Se llama en cada frame con el tiempo real: deja salir mensajes de la cola de la crónica */
  tick(nowMs: number): void {
    this.chronicle.tick(nowMs);
    if (this.chronicle.revision !== this.chronicleRevision) {
      this.chronicleRevision = this.chronicle.revision;
      this.chronicleEntries.set([...this.chronicle.entries]);
      this.chronicleStrip.set([...this.chronicle.strip]);
    }
  }

  log(draft: ChronicleDraft): void {
    this.chronicle.push(draft, this.engine.time, performance.now());
  }

  // ── Idioma ──

  /** Idioma que propone el OS: solo se aplica si el jugador no eligió otro antes */
  suggestLang(lang: SandworldLang): void {
    if (!this.hasStoredLang) this.translator.setLang(lang);
  }

  setLang(lang: SandworldLang): void {
    this.translator.setLang(lang);
    this.hasStoredLang = true;
    this.storage.save({ ...this.storage.load(), lang });
  }

  // ── Velocidad y pausa ──

  setSpeed(speed: SimSpeed): void {
    this.speed.set(speed);
    this.engine.setSpeed(speed);
  }

  cycleSpeed(): void {
    const i = SIM_SPEEDS.indexOf(this.speed());
    this.setSpeed(SIM_SPEEDS[(i + 1) % SIM_SPEEDS.length]);
  }

  togglePause(): void {
    this.isPaused.update(p => !p);
    this.syncPause();
  }

  // ── Menús y paneles ──

  /** Ajustes y crónica pausan el juego mientras están abiertos */
  openMenu(menu: HudMenu): void {
    this.panel.set(null);
    this.menu.set(menu);
    this.syncPause();
  }

  closeMenu(): void {
    this.menu.set(null);
    this.syncPause();
  }

  /** Los paneles de las tablas no pausan. Solo uno abierto a la vez. */
  togglePanel(panel: HudPanel): void {
    this.closeAnimal();
    this.panel.update(p => (p === panel ? null : panel));
  }

  closePanel(): void {
    this.panel.set(null);
  }

  /** Elegir una arena activa el pincel; elegir la misma otra vez la suelta */
  selectSand(sand: SandId | null): void {
    this.selectedSand.update(s => (s === sand ? null : sand));
  }

  // ── Pincel de arena ──

  /** El dedo se apoya: empieza un trazo con la arena elegida */
  beginStroke(): void {
    const sand = this.selectedSand();
    this.stroke = sand ? new Stroke(sand) : null;
    this.strokeLeft.set(1);
  }

  /** El dedo pasa `seconds` sobre el bloque de la celda global (gx, gy). Devuelve si cayó arena. */
  pourAt(gx: number, gy: number, seconds: number): boolean {
    const stroke = this.stroke;
    if (!stroke) return false;
    const changed = stroke.pour(gx, gy, seconds);
    if (changed.length === 0) return false;
    this.pours.preview(stroke.sand, changed);
    this.events.emit('terrainChanged', chunksOf(changed));
    // La botella baja de 2 en 2 % (no hace falta avisar a la interfaz en cada frame)
    if (Math.abs(this.strokeLeft() - stroke.remaining) >= 0.02 || stroke.remaining === 0) this.strokeLeft.set(stroke.remaining);
    return true;
  }

  /** El dedo se levanta: lo vertido pasa a la cola y empieza a asentarse */
  endStroke(): void {
    if (this.stroke) this.pours.commit(this.stroke);
    this.stroke = null;
    this.strokeLeft.set(1);
  }

  /** Color de los granos que caen (el de la arena elegida) */
  sandColor(): number {
    const sand = this.stroke?.sand ?? this.selectedSand();
    return sand ? SAND_COLOR_NUM[SAND_ORDER.indexOf(sand)] : 0xffffff;
  }

  /**
   * Cada minuto los vertidos aplican su parte. Las arenas con masa cambian la altura y se redibujan cada minuto;
   * las demás solo adelgazan su capa, así que basta con redibujarlas cada PENDING_REDRAW_MINUTES.
   */
  private settlePours(minute: number): void {
    if (this.pours.active.length === 0) return;
    const redrawAll = minute % PENDING_REDRAW_MINUTES === 0;
    const heavy = this.pours.active.some(p => !SAND_EFFECTS[p.sand].massless);
    const chunks = redrawAll || heavy ? this.pours.chunksWithPours() : null;
    const settled = this.pours.minute();
    if (chunks) this.events.emit('terrainChanged', [...chunks].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    }));
    for (const s of settled) this.onSettled(s);
  }

  /** El tiempo ha cambiado: actualiza el icono y lo cuenta en la crónica */
  private reportWeather(news: readonly WeatherNews[]): void {
    const now = this.weatherSystem.current;
    if (now !== this.weather()) {
      const before = this.weather();
      if (before.key !== now.key || before.look !== now.look) this.weather.set(now);
    }
    for (const n of news) {
      if (n.type === 'drought') this.log({ type: 'world', key: 'chronicle.drought', params: { days: n.days }, priority: 6 });
      else this.log({ type: 'world', key: `chronicle.weather.${n.key}.${n.type}${n.look === 'snow' ? 'Snow' : ''}`, priority: 3 });
    }
  }

  /** Cuenta en la crónica lo que han provocado las arenas y los manantiales que se tapan o se abren */
  private reportWorldEvents(): void {
    const seen = new Set<string>();
    for (const e of this.pours.events.splice(0)) {
      const key = `${e.sand}:${e.outcome}`;
      if (seen.has(key)) continue;          // un aviso por tipo y minuto, aunque pase en muchas celdas
      seen.add(key);
      this.log({ type: 'world', key: `chronicle.outcome.${e.outcome}`, priority: 6 });
    }
    for (const c of this.physics.takeSpringChanges()) {
      this.log({ type: 'world', key: `chronicle.spring.${c.state}`, priority: 6 });
    }
  }

  /** Cuenta el fuego en la crónica (un aviso por tipo y minuto) y pasa los rayos al dibujo */
  private reportFire(): void {
    const news = this.physics.fire.news.splice(0);
    if (!news.length) return;
    const told = new Set<string>();
    const tell = (key: string, priority: number) => {
      if (told.has(key)) return;
      told.add(key);
      this.log({ type: 'world', key, priority });
    };
    for (const n of news) {
      switch (n.type) {
        case 'strike':
          this.events.emit('lightning', { gx: n.gx, gy: n.gy });
          tell(n.ignited ? 'chronicle.fire.lightningFire' : 'chronicle.fire.lightning', n.ignited ? 8 : 4);
          break;
        case 'ignite': if (n.cause === 'brasa') tell('chronicle.fire.brasa', 7); break;
        case 'out': tell('chronicle.fire.out', 5); break;
        case 'burntLand': tell('chronicle.fire.burntLand', 9); break;
        case 'remit': tell('chronicle.fire.remit', 6); break;
      }
    }
  }

  /** Cuenta en la crónica lo que pasa en la fauna (un aviso por tipo y especie en cada minuto) */
  private reportFauna(): void {
    const news = this.fauna.news.splice(0);
    if (!news.length) return;
    const told = new Set<string>();
    const tell = (n: FaunaNews, event: string, priority: number, params?: Record<string, string | number>) => {
      const key = `chronicle.fauna.${SPECIES_DEFS[n.species].key}.${event}`;
      if (told.has(key)) return;
      told.add(key);
      this.log({ type: 'species', key, params, priority });
    };
    for (const n of news) {
      switch (n.type) {
        case 'arrived': tell(n, 'arrived', 8, { count: n.count }); break;
        case 'born': tell(n, n.twins ? 'twins' : 'born', 6, { name: n.name, mother: n.mother }); break;
        case 'died': tell(n, `died.${n.cause}`, 6, { name: n.name }); break;
        case 'herdSplit': tell(n, 'herdSplit', 5); break;
        case 'hunger': tell(n, 'hunger', 8); break;
        case 'poisoned': tell(n, 'poisoned', 6, { name: n.name, food: `@plant.${PLANT_DEFS[n.plant].key}` }); break;
        case 'lost': tell(n, `lost.${n.outcome}`, 5, { name: n.name }); break;
        case 'discovered':
          // La crónica cuenta que una especie se come una planta: el jugador la conoce desde ahora
          this.world.discoveredPlants.add(n.plant);
          tell(n, 'discovered', 4, { food: `@plant.${PLANT_DEFS[n.plant].key}` });
          break;
      }
    }
  }

  /** Orden del jugador a un animal desde su ficha (comer, dormir, correr). Devuelve si la acepta. */
  orderAnimal(id: number, order: AnimalOrder): boolean {
    const ok = this.fauna.order(id, order, this.engine.time.totalMinutes);
    this.refreshAnimal();
    return ok;
  }

  /** Se ha tocado un animal en el mapa: se abre su ficha (y se cierra el panel que hubiera) */
  selectAnimal(id: number): void {
    this.panel.set(null);
    this.inspected.set([]);
    this.selectedAnimal.set(id);
    this.refreshAnimal();
  }

  closeAnimal(): void {
    this.selectedAnimal.set(null);
    this.animalView.set(null);
  }

  /** Nueva foto del animal elegido (si ya no existe, por ejemplo un cadáver que se deshizo, se cierra su ficha) */
  private refreshAnimal(): void {
    const id = this.selectedAnimal();
    if (id === null) return;
    const view = animalView(this.fauna, id, this.engine.time.totalMinutes);
    if (!view) this.closeAnimal();
    else this.animalView.set(view);
  }

  /** Revisa la vegetación: recoloca las plantas de los chunks que cambian y actualiza la barra de Vegetación */
  private updateVegetation(season: number): void {
    const changes = this.vegetation.update(VEGETATION_CHECK_MINUTES / 1440, season as 0 | 1 | 2 | 3);
    const soil = this.vegetation.takeSoilChanges();
    if (soil.length) this.events.emit('terrainChanged', soil);
    if (changes.length === 0) return;
    this.events.emit('vegetationChanged', changes);
    this.refreshIndicators();
  }

  /** Revisa los biomas: redibuja los chunks que cambian y lo cuenta en la crónica (un aviso por bioma nuevo) */
  private updateBiomes(): void {
    const changes = this.biomes.update(BIOME_CHECK_MINUTES / 1440);
    if (changes.length === 0) return;
    const chunks = new Map<string, ChunkCoord>();
    const born = new Set<string>();
    for (const c of changes) {
      chunks.set(`${c.cx},${c.cy}`, { cx: c.cx, cy: c.cy });
      born.add(BIOME_BY_ID[c.to].key);
    }
    this.events.emit('terrainChanged', [...chunks.values()]);
    for (const key of born) this.log({ type: 'world', key: `chronicle.biome.${key}`, priority: key === 'glade' ? 9 : 6 });
    this.refreshIndicators();
  }

  private onSettled(s: SettledPour): void {
    this.events.emit('terrainChanged', chunksOf(s.cells));
    this.log({ type: 'world', key: `chronicle.settled.${s.sand}`, priority: 4 });
  }

  /**
   * Descubre el siguiente chunk bajo las nubes y sube el nivel de la isla.
   * Hoy lo dispara el botón de prueba de Ajustes; en la fase 7, las reglas de expansión.
   */
  revealNextChunk(): void {
    const next = nextChunkToReveal(this.world.exploration);
    if (!next || !this.world.exploration.reveal(next.cx, next.cy)) return;
    this.world.chunk(next.cx, next.cy);
    this.physics.chunkRevealed(next.cx, next.cy);
    this.world.level++;
    this.events.emit('chunkRevealed', next);
    this.log({ type: 'world', key: 'chronicle.reveal', params: { level: this.world.level }, priority: 8 });
    this.refreshIndicators();
    this.showIslandLabel();
  }

  /** TEMPORAL (prueba del bloque 1): deja caer un montón de arena en un sitio al azar de la isla */
  debugSandPile(): void {
    const at = this.randomCell((c, k) => c.water[k] < 0.05, 3);
    if (!at) return;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.physics.deposit(at.gx + dx, at.gy + dy, Material.SAND, 4);
    this.events.emit('terrainChanged', [{ cx: at.cx, cy: at.cy }]);
    this.focus(at.gx, at.gy);
  }

  /** TEMPORAL (prueba del bloque 2): manantial en una cumbre o ladera al azar, lejos de los que ya hay */
  debugSpring(): void {
    const C = WORLD.CELLS;
    const at = this.randomCell((c, k) => {
      if (c.water[k] > 0.05 || c.spring[k] > 0) return false;
      const x = k % C, y = Math.floor(k / C);
      // Algo de altura respecto a la media del chunk y sin otro manantial cerca
      let mean = 0;
      for (let n = 0; n < C * C; n += 7) mean += c.rock[n] + c.sediment[n];
      mean /= Math.ceil((C * C) / 7);
      if (c.rock[k] + c.sediment[k] < mean) return false;
      for (let n = 0; n < C * C; n++) if (c.spring[n] > 0 && Math.hypot((n % C) - x, Math.floor(n / C) - y) < 8) return false;
      return true;
    }, 2);
    if (!at) return;
    this.physics.setSpring(at.gx, at.gy, 0.05);
    this.focus(at.gx, at.gy);
  }

  /** TEMPORAL (modo desarrollo): Tierra Quemada de 3 × 3 tiles en un sitio al azar con tierra (no agua) */
  debugBurntLand(): void {
    const N = WORLD.TILES, G = WORLD.CELLS_PER_TILE;
    const chunks = this.world.exploration.list();
    for (let attempt = 0; attempt < 200; attempt++) {
      const { cx, cy } = chunks[Math.floor(Math.random() * chunks.length)];
      const gi = cx * N + Math.floor(Math.random() * N), gj = cy * N + Math.floor(Math.random() * N);
      let ok = true;
      for (let dj = 0; dj < 3 && ok; dj++) for (let di = 0; di < 3 && ok; di++) {
        const tcx = Math.floor((gi + di) / N), tcy = Math.floor((gj + dj) / N);
        if (!this.world.exploration.isRevealed(tcx, tcy)) { ok = false; break; }
        const c = this.world.chunk(tcx, tcy);
        const i = gi + di - tcx * N, j = gj + dj - tcy * N;
        let wet = 0;
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (c.water[cellIndex(i * G + x, j * G + y)] > 0.05) wet++;
        if (wet > 4) ok = false;
      }
      if (!ok) continue;
      this.physics.fire.makeBurntLand(gi, gj);
      this.reportFire();
      this.updateBiomes();
      this.events.emit('vegetationChanged', this.world.exploration.list());
      this.events.emit('terrainChanged', this.world.exploration.list());
      this.focus((gi + 1.5) * G, (gj + 1.5) * G);
      return;
    }
  }

  /** TEMPORAL (modo desarrollo): prende fuego a un tile con vegetación al azar (aunque no esté seco) */
  debugIgnite(): void {
    const N = WORLD.TILES, G = WORLD.CELLS_PER_TILE;
    const chunks = this.world.exploration.list();
    let best: { gx: number; gy: number } | null = null, bestFuel = 0;
    for (let n = 0; n < 40; n++) {
      const { cx, cy } = chunks[Math.floor(Math.random() * chunks.length)];
      const i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * N);
      const fuel = this.physics.fire.fuel(this.world.chunk(cx, cy), i, j);
      if (fuel > bestFuel) { bestFuel = fuel; best = { gx: (cx * N + i) * G + 2, gy: (cy * N + j) * G + 2 }; }
    }
    if (!best || !this.physics.fire.igniteAtCell(best.gx, best.gy, 'dev', true)) return;
    this.log({ type: 'world', key: 'chronicle.fire.dev', priority: 7 });
    this.focus(best.gx, best.gy);
  }

  /**
   * Celda al azar en cualquier chunk descubierto que cumpla `ok`, lejos del borde de la isla `margin` celdas.
   * Sirve a los botones de prueba para repartir las pruebas por toda la isla.
   */
  private randomCell(ok: (c: ChunkData, k: number) => boolean, margin: number): { cx: number; cy: number; gx: number; gy: number } | null {
    const C = WORLD.CELLS;
    const chunks = this.world.exploration.list();
    for (let attempt = 0; attempt < 400; attempt++) {
      const { cx, cy } = chunks[Math.floor(Math.random() * chunks.length)];
      const ci = margin + Math.floor(Math.random() * (C - 2 * margin)), cj = margin + Math.floor(Math.random() * (C - 2 * margin));
      const c = this.world.chunk(cx, cy);
      if (ok(c, cellIndex(ci, cj))) return { cx, cy, gx: cx * C + ci, gy: cy * C + cj };
    }
    return null;
  }

  /** Lleva la cámara hasta una celda global (lo que acaba de hacer un botón de prueba) */
  private focus(gx: number, gy: number): void {
    this.events.emit('focus', { gx, gy });
  }

  /**
   * TEMPORAL (modo desarrollo): suelta una manada de ciervos (2 hembras, 1 macho y 1 cría) en un sitio al azar
   * por el que se pueda andar y con comida. `herds` > 1: varias a la vez (para probar la sobrepoblación).
   */
  debugDeerHerd(herds = 1): void {
    const now = this.engine.time.totalMinutes, season = this.engine.time.season;
    const deer = SPECIES_DEFS[0];
    let last: { gx: number; gy: number } | null = null;
    for (let h = 0; h < herds; h++) {
      const at = this.randomCell((c, k) => {
        const C = WORLD.CELLS, gx = c.cx * C + (k % C), gy = c.cy * C + Math.floor(k / C);
        return this.faunaWorld.walkable(gx, gy) && this.faunaWorld.foodAt(gx, gy, deer.diets, new Set(), now, season) > 0.05;
      }, 4);
      if (!at) continue;
      this.fauna.spawnHerd(deer.key, at.gx + 0.5, at.gy + 0.5, now);
      last = at;
    }
    this.reportFauna();
    if (last) this.focus(last.gx, last.gy);
  }

  /** TEMPORAL (modo desarrollo): despierta un claro sin sorteo en el tile sano más cercano al centro de la isla inicial */
  debugGlade(): void {
    if (this.biomes.forceGlade(0, 0)) this.updateBiomes();
  }

  /** TEMPORAL (modo desarrollo): botones de prueba de Ajustes */
  runDevAction(action: DevAction): void {
    switch (action) {
      case 'reveal': return this.revealNextChunk();
      case 'sandPile': return this.debugSandPile();
      case 'spring': return this.debugSpring();
      case 'rain': return this.weatherSystem.forceNow('rain', this.engine.time.totalMinutes);
      case 'nextSeason': return this.debugNextSeason();
      case 'glade': return this.debugGlade();
      case 'viewValues': return this.toggleDevView('values');
      case 'viewBiomes': return this.toggleDevView('biomes');
      case 'discoverPlants': return this.debugDiscoverPlants();
      case 'garden': return this.debugGarden();
      case 'eatFruit': return this.debugEatFruit();
      case 'fruitAllYear': plantDevFlags.fruitAllYear = !plantDevFlags.fruitAllYear; return;
      case 'storm': return this.weatherSystem.forceNow('storm', this.engine.time.totalMinutes);
      case 'dryStorm': return this.weatherSystem.forceNow('dryStorm', this.engine.time.totalMinutes);
      case 'ignite': return this.debugIgnite();
      case 'burntLand': return this.debugBurntLand();
      case 'deerHerd': return this.debugDeerHerd();
      case 'overpopulate': return this.debugDeerHerd(6);
      case 'ageAnimals': return this.fauna.ageAll(30);
      case 'drainLife':
        if (this.physics.fire.drainLife() > 0) this.log({ type: 'world', key: 'chronicle.fire.drained', priority: 6 });
        return;
    }
  }

  /** TEMPORAL (modo desarrollo): muestra una capa de prueba sobre la isla, u oculta la que está si es la misma */
  toggleDevView(view: DevTileView): void {
    this.devView.update(v => (v === view ? null : view));
  }

  /** TEMPORAL (modo desarrollo): el jugador conoce todas las plantas (o ninguna, si ya las conocía) */
  debugDiscoverPlants(): void {
    const all = this.world.discoveredPlants.size === PLANT_DEFS.length;
    this.world.discoveredPlants.clear();
    if (!all) for (const p of PLANT_DEFS) this.world.discoveredPlants.add(p.id);
  }

  /**
   * TEMPORAL (modo desarrollo): siembra un huerto en un sitio llano al azar de la isla, como lo haría una especie
   * evolucionada (fase 6): 4 × 2 casillas de bayas rojas (una por casilla) y dos manzanos a los lados, con una
   * casilla libre entre árboles.
   */
  debugGarden(): void {
    const revealed = (cx: number, cy: number) => this.world.exploration.isRevealed(cx, cy);
    const berries = PLANT_DEFS.find(p => p.key === 'redBerries')!.id;
    const apple = PLANT_DEFS.find(p => p.key === 'appleTree')!.id;
    const B = 2;   // celdas por casilla (BRUSH_CELLS)
    const C = WORLD.CELLS;
    const spots: [number, number, number, number][] = [];
    for (const { cx, cy } of this.world.exploration.list()) {
      for (let y = 4; y < 26; y += B) for (let x = 6; x < 22; x += B) spots.push([cx, cy, cx * C + x, cy * C + y]);
    }
    // Al azar (Fisher-Yates)
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (const [cx, cy, x, y] of spots) {
      const chunk = this.world.chunk(cx, cy);
      const saved = chunk.crop.slice();
      const blocks: [number, number][] = [];
      for (let by = 0; by < 2; by++) for (let bx = 0; bx < 4; bx++) blocks.push([x + bx * B, y + by * B]);
      if (!blocks.every(([gx, gy]) => this.vegetation.sow(berries, gx, gy, revealed))) {
        chunk.crop.set(saved);
        continue;
      }
      this.vegetation.sow(apple, x - B, y, revealed);
      this.vegetation.sow(apple, x + 4 * B, y + B, revealed);
      this.events.emit('vegetationChanged', [{ cx, cy }]);
      this.focus(x + 4, y + 2);
      return;
    }
  }

  /** TEMPORAL (modo desarrollo): algo se come el fruto de todas las plantas (vuelve poco a poco) */
  debugEatFruit(): void {
    for (const { cx, cy } of this.world.exploration.list()) eatFruit(this.world.chunk(cx, cy), this.engine.time.totalMinutes);
  }

  /** TEMPORAL (modo desarrollo): salta a la estación siguiente */
  debugNextSeason(): void {
    this.engine.skipToNextSeason();
  }

  /**
   * Toque en un tile sin arena: muestra un momento junto al dedo qué hay ahí.
   * - Una planta: su nombre si el jugador ya la conoce (la crónica contó que una especie se la come);
   *   si no, "Árbol / Arbusto / Planta por descubrir".
   * - Un lago o un río: "Agua" (el humedal ya es un bioma de agua y sale con su nombre).
   * - Si no, el bioma.
   */
  inspectTile(t: TappedTile): void {
    const chunk = this.world.chunk(t.cx, t.cy);
    const biome = chunk.biome[tileIndex(t.i, t.j)] as BiomeId;
    const water = chunk.water[cellIndex(t.ci, t.cj)] > INSPECT_WATER && biome !== Biome.WETLAND;
    let labelKey = water ? 'biome.water' : `biome.${BIOME_BY_ID[biome].key}`;
    if (t.plant !== null) {
      const plant = PLANT_DEFS[t.plant];
      labelKey = this.world.discoveredPlants.has(plant.id) ? `plant.${plant.key}` : `plant.unknown.${plant.kind}`;
    }
    this.inspected.set([{ id: ++this.inspectId, labelKey, x: t.screenX, y: t.screenY }]);
    if (this.inspectTimer) clearTimeout(this.inspectTimer);
    this.inspectTimer = setTimeout(() => this.inspected.set([]), INSPECT_MS);
  }

  showIslandLabel(): void {
    this.islandLabel.set(true);
    if (this.islandLabelTimer) clearTimeout(this.islandLabelTimer);
    this.islandLabelTimer = setTimeout(() => this.islandLabel.set(false), ISLAND_LABEL_MS);
  }

  private syncPause(): void {
    this.engine.setPaused(this.isPaused() || this.menu() !== null);
  }

  private refreshIndicators(): void {
    this.indicatorValues.set(this.indicators.snapshot());
  }
}

/** Chunks (sin repetir) que contienen estas celdas globales */
function chunksOf(cells: readonly (readonly number[])[]): ChunkCoord[] {
  const C = WORLD.CELLS;
  const seen = new Map<string, ChunkCoord>();
  for (const [gx, gy] of cells) {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    seen.set(`${cx},${cy}`, { cx, cy });
  }
  return [...seen.values()];
}
