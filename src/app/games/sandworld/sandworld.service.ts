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
import { BiomeId } from './domain/models/biome.model';
import { Season } from './domain/models/time.model';
import { DevTileView } from './rendering/dev/dev-tile-overlay';
import { DevAction } from './config/dev.config';
import { SAND_COLOR_NUM } from './config/sands.config';
import { PENDING_REDRAW_MINUTES } from './config/pour.config';
import { Translator } from './i18n/translator';
import { SETTINGS_STORAGE } from './infrastructure/settings-storage.token';
import { DEFAULT_SEED } from './config/world.config';

/** El reloj de la interfaz avanza de 10 en 10 minutos de juego, como en Stardew */
const CLOCK_STEP_MINUTES = 10;
/** Milisegundos que se ve el nombre del bioma al tocar un tile */
const INSPECT_MS = 2500;
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
  /** Tiempo atmosférico: lluvia (o nieve), repartida al azar en cada estación según el registro de fenómenos */
  readonly weatherSystem = new WeatherSystem(this.physics, new SeededRandom(this.world.seed * 7907 + 3));
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
  readonly chronicleEntries = signal<readonly ChronicleEntry[]>([]);
  readonly indicatorValues = signal<readonly IndicatorValue[]>([]);
  readonly islandLabel = signal(false);
  /** Modo desarrollo: capa de esencia y afinidad o de biomas sobre la isla (null = ninguna) */
  readonly devView = signal<DevTileView | null>(null);
  /** El tiempo que hace (la placa de la hora muestra su icono) */
  readonly weather = signal<WeatherState>(CLEAR_WEATHER);
  /** Tile tocado sin arena: qué bioma es y dónde enseñarlo */
  readonly inspected = signal<{ readonly biomeKey: string; readonly x: number; readonly y: number } | null>(null);
  private inspectTimer: ReturnType<typeof setTimeout> | null = null;
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
      const changed = this.physics.minute();
      if (changed.length) this.events.emit('terrainChanged', changed);
      this.settlePours(t.minute);
      this.reportWorldEvents();
      if (t.minute % BIOME_CHECK_MINUTES === 0) this.updateBiomes();
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

  /** TEMPORAL (prueba del bloque 1): deja caer un montón de arena en el centro de la isla inicial */
  debugSandPile(): void {
    for (const [x, y] of [[15, 15], [16, 15], [15, 16], [16, 16]]) this.physics.deposit(x, y, Material.SAND, 4);
    this.events.emit('terrainChanged', [{ cx: 0, cy: 0 }]);
  }

  /** TEMPORAL (prueba del bloque 2): manantial en la cumbre más alta lejos de los que ya hay */
  debugSpring(): void {
    const chunk = this.world.chunk(0, 0);
    const C = Math.round(Math.sqrt(chunk.spring.length));
    const existing = [...chunk.spring].map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0);
    let best = -1, bestH = -Infinity;
    for (let k = 0; k < chunk.spring.length; k++) {
      const x = k % C, y = Math.floor(k / C);
      if (x < 2 || y < 2 || x > C - 3 || y > C - 3) continue;
      if (existing.some(e => Math.hypot((e % C) - x, Math.floor(e / C) - y) < 10)) continue;
      const h = chunk.rock[k] + chunk.sediment[k];
      if (h > bestH) { bestH = h; best = k; }
    }
    if (best >= 0) this.physics.setSpring(best % C, Math.floor(best / C), 0.05);
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
    }
  }

  /** TEMPORAL (modo desarrollo): muestra una capa de prueba sobre la isla, u oculta la que está si es la misma */
  toggleDevView(view: DevTileView): void {
    this.devView.update(v => (v === view ? null : view));
  }

  /** TEMPORAL (modo desarrollo): salta a la estación siguiente */
  debugNextSeason(): void {
    this.engine.skipToNextSeason();
  }

  /** Toque en un tile sin arena: muestra su bioma un momento junto al dedo */
  inspectTile(cx: number, cy: number, i: number, j: number, x: number, y: number): void {
    const biome = this.world.chunk(cx, cy).biome[j * 8 + i] as BiomeId;
    this.inspected.set({ biomeKey: BIOME_BY_ID[biome].key, x, y });
    if (this.inspectTimer) clearTimeout(this.inspectTimer);
    this.inspectTimer = setTimeout(() => this.inspected.set(null), INSPECT_MS);
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
