import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { SandworldLang, SimSpeed, SIM_SPEEDS } from './domain/models/settings.model';
import { GameTime } from './domain/models/time.model';
import { GameEvents } from './domain/events/game-events';
import { ChronicleDraft, ChronicleEntry } from './domain/models/chronicle.model';
import { SandId } from './domain/models/sand.model';
import { EventBus } from './application/events/event-bus';
import { TimeEngine } from './application/time/time-engine';
import { Chronicle } from './application/chronicle/chronicle';
import { IndicatorRegistry, IndicatorValue } from './application/indicators/indicator-registry';
import { registerWorldIndicators } from './application/indicators/world-indicators';
import { World } from './application/world/world';
import { nextChunkToReveal } from './application/world/expansion';
import { TerrainPhysics } from './application/physics/terrain-physics';
import { Material } from './domain/models/material.model';
import { Translator } from './i18n/translator';
import { SETTINGS_STORAGE } from './infrastructure/settings-storage.token';
import { DEFAULT_SEED } from './config/world.config';

/** El reloj de la interfaz avanza de 10 en 10 minutos de juego, como en Stardew */
const CLOCK_STEP_MINUTES = 10;
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
    this.events.on('minute', () => {
      const changed = this.physics.minute();
      if (changed.length) this.events.emit('terrainChanged', changed);
    });
    this.events.on('dawn', () => this.log({ type: 'time', key: 'chronicle.dawn' }));
    this.events.on('dusk', () => this.log({ type: 'time', key: 'chronicle.dusk' }));
    this.events.on('newDay', t => this.log({ type: 'time', key: 'chronicle.newDay', params: { day: t.day } }));
    this.events.on('newSeason', t => this.log({ type: 'world', key: `chronicle.newSeason.${t.season}`, priority: 5 }));
  }

  ngOnDestroy(): void {
    this.events.clear();
    if (this.islandLabelTimer) clearTimeout(this.islandLabelTimer);
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
    if (best >= 0) this.physics.setSpring(best % C, Math.floor(best / C), 0.08);
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
