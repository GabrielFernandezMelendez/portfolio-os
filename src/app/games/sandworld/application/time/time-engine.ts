import { EventBus } from '../events/event-bus';
import { GameEvents } from '../../domain/events/game-events';
import { CALENDAR, GameTime, toGameTime } from '../../domain/models/time.model';
import { SimSpeed } from '../../domain/models/settings.model';
import { MAX_FRAME_MS, REAL_SECONDS_PER_DAY, START_MINUTE } from '../../config/time.config';

/** Segundos reales que dura un minuto de juego a x1 */
const REAL_SECONDS_PER_MINUTE = REAL_SECONDS_PER_DAY / CALENDAR.MINUTES_PER_DAY;

/**
 * Motor de tiempo de paso fijo.
 * Recibe el tiempo real de cada frame, lo multiplica por la velocidad y avanza el mundo
 * de minuto de juego en minuto de juego, emitiendo eventos en los límites (hora, amanecer, día, estación).
 * No toca el reloj del navegador: quien lo usa le pasa los milisegundos, así los tests controlan el tiempo.
 */
export class TimeEngine {
  private total: number;
  private fraction = 0;
  private current: GameTime;
  private speed: SimSpeed = 1;
  private paused = false;

  constructor(private readonly bus: EventBus<GameEvents>, startMinute: number = START_MINUTE) {
    this.total = Math.floor(startMinute);
    this.current = toGameTime(this.total);
  }

  get time(): GameTime {
    return this.current;
  }

  /** Minuto del día con decimales: para transiciones suaves de luz entre pasos */
  get exactMinuteOfDay(): number {
    return this.current.minuteOfDay + this.fraction;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setSpeed(speed: SimSpeed): void {
    this.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Avanza según los milisegundos reales transcurridos. Devuelve cuántos minutos de juego han pasado. */
  update(realMs: number): number {
    if (this.paused || realMs <= 0) return 0;
    const ms = Math.min(realMs, MAX_FRAME_MS);
    this.fraction += (ms / 1000) * this.speed / REAL_SECONDS_PER_MINUTE;

    let steps = 0;
    while (this.fraction >= 1) {
      this.fraction -= 1;
      this.step();
      steps++;
    }
    return steps;
  }

  private step(): void {
    this.total++;
    const t = toGameTime(this.total);
    this.current = t;

    this.bus.emit('minute', t);
    if (t.minute === 0) this.bus.emit('hour', t);
    if (t.minuteOfDay === CALENDAR.DAWN) this.bus.emit('dawn', t);
    if (t.minuteOfDay === CALENDAR.DUSK) this.bus.emit('dusk', t);
    if (t.minuteOfDay === 0) {
      this.bus.emit('newDay', t);
      if (t.dayOfSeason === 1) this.bus.emit('newSeason', t);
    }
  }
}
