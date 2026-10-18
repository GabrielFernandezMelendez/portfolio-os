import { Injectable, OnDestroy, signal } from '@angular/core';
import { DEFAULT_LANG, SandworldLang, SimSpeed, SIM_SPEEDS } from './domain/models/settings.model';
import { GameTime } from './domain/models/time.model';
import { GameEvents } from './domain/events/game-events';
import { EventBus } from './application/events/event-bus';
import { TimeEngine } from './application/time/time-engine';

/** El reloj de la interfaz avanza de 10 en 10 minutos de juego, como en Stardew (y sin refrescar el HUD 25 veces por segundo a x4) */
const CLOCK_STEP_MINUTES = 10;

/**
 * Estado del juego que necesita la interfaz (HUD).
 * Se provee en el componente raíz (no en 'root'): nace al abrir el juego y muere al cerrarlo,
 * así no queda estado vivo en el portfolio y el juego se puede extraer tal cual.
 * El estado del mundo (celdas, agua, animales) NO va en signals: vive en arrays tipados del dominio.
 */
@Injectable()
export class SandworldService implements OnDestroy {
  /** Bus de eventos del juego y motor de tiempo: una instancia por partida */
  readonly events = new EventBus<GameEvents>();
  readonly engine = new TimeEngine(this.events);

  readonly lang = signal<SandworldLang>(DEFAULT_LANG);
  readonly speed = signal<SimSpeed>(1);
  readonly isPaused = signal(false);
  readonly isReady = signal(false);
  readonly time = signal<GameTime>(this.engine.time);

  constructor() {
    this.events.on('minute', t => {
      if (t.minute % CLOCK_STEP_MINUTES === 0) this.time.set(t);
    });
  }

  ngOnDestroy(): void {
    this.events.clear();
  }

  setLang(lang: SandworldLang): void {
    this.lang.set(lang);
  }

  setSpeed(speed: SimSpeed): void {
    this.speed.set(speed);
    this.engine.setSpeed(speed);
  }

  cycleSpeed(): void {
    const i = SIM_SPEEDS.indexOf(this.speed());
    this.setSpeed(SIM_SPEEDS[(i + 1) % SIM_SPEEDS.length]);
  }

  pause(): void {
    this.isPaused.set(true);
    this.engine.setPaused(true);
  }

  resume(): void {
    this.isPaused.set(false);
    this.engine.setPaused(false);
  }

  togglePause(): void {
    if (this.isPaused()) this.resume();
    else this.pause();
  }
}
