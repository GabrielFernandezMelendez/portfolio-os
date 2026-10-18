import { TimeEngine } from './time-engine';
import { EventBus } from '../events/event-bus';
import { GameEvents } from '../../domain/events/game-events';
import { CALENDAR, DAYS_PER_YEAR, Season, toGameTime } from '../../domain/models/time.model';
import { REAL_SECONDS_PER_DAY } from '../../config/time.config';

/** Milisegundos reales de un minuto de juego a x1 */
const MINUTE_MS = (REAL_SECONDS_PER_DAY * 1000) / CALENDAR.MINUTES_PER_DAY;

/** Avanza el motor en frames de 16 ms hasta cubrir `ms` */
function run(engine: TimeEngine, ms: number): void {
  for (let left = ms; left > 0; left -= 16) engine.update(Math.min(16, left));
}

describe('toGameTime', () => {
  it('descompone los minutos en calendario', () => {
    const t = toGameTime(CALENDAR.MINUTES_PER_DAY * (CALENDAR.DAYS_PER_SEASON + 2) + 13 * 60 + 25);
    expect(t.day).toBe(CALENDAR.DAYS_PER_SEASON + 3);
    expect(t.season).toBe(Season.SUMMER);
    expect(t.dayOfSeason).toBe(3);
    expect(t.hour).toBe(13);
    expect(t.minute).toBe(25);
    expect(t.year).toBe(1);
  });

  it('cambia de año tras 4 estaciones', () => {
    const t = toGameTime(CALENDAR.MINUTES_PER_DAY * DAYS_PER_YEAR);
    expect(t.year).toBe(2);
    expect(t.season).toBe(Season.SPRING);
    expect(t.dayOfSeason).toBe(1);
  });
});

describe('TimeEngine', () => {
  let bus: EventBus<GameEvents>;
  beforeEach(() => (bus = new EventBus<GameEvents>()));

  it('un día dura REAL_SECONDS_PER_DAY a x1', () => {
    const engine = new TimeEngine(bus, 0);
    run(engine, REAL_SECONDS_PER_DAY * 1000 + 5);
    expect(engine.time.day).toBe(2);
    expect(engine.time.minuteOfDay).toBeLessThan(2);
  });

  it('x4 avanza cuatro veces más rápido y la pausa lo detiene', () => {
    const a = new TimeEngine(bus, 0);
    const b = new TimeEngine(new EventBus<GameEvents>(), 0);
    b.setSpeed(4);
    run(a, 10_000);
    run(b, 10_000);
    // Se compara con el valor exacto: cada motor redondea a minutos enteros por su cuenta
    expect(Math.abs(a.time.totalMinutes - 10_000 / MINUTE_MS)).toBeLessThan(1.01);
    expect(Math.abs(b.time.totalMinutes - (4 * 10_000) / MINUTE_MS)).toBeLessThan(1.01);

    b.setPaused(true);
    const before = b.time.totalMinutes;
    run(b, 10_000);
    expect(b.time.totalMinutes).toBe(before);
  });

  it('emite amanecer, anochecer, hora y día nuevo en el minuto exacto', () => {
    const engine = new TimeEngine(bus, 0);
    const seen: Record<string, number[]> = { dawn: [], dusk: [], newDay: [], hour: [] };
    bus.on('dawn', t => seen['dawn'].push(t.minuteOfDay));
    bus.on('dusk', t => seen['dusk'].push(t.minuteOfDay));
    bus.on('newDay', t => seen['newDay'].push(t.day));
    bus.on('hour', t => seen['hour'].push(t.hour));
    run(engine, MINUTE_MS * CALENDAR.MINUTES_PER_DAY + 50);
    expect(seen['dawn']).toEqual([CALENDAR.DAWN]);
    expect(seen['dusk']).toEqual([CALENDAR.DUSK]);
    expect(seen['newDay']).toEqual([2]);
    expect(seen['hour'].length).toBe(24);
  });

  it('emite estación nueva al empezar el día 1 de la siguiente', () => {
    const lastMinute = CALENDAR.MINUTES_PER_DAY * CALENDAR.DAYS_PER_SEASON - 1;
    const engine = new TimeEngine(bus, lastMinute);
    const seasons: number[] = [];
    bus.on('newSeason', t => seasons.push(t.season));
    run(engine, MINUTE_MS * 2);
    expect(seasons).toEqual([Season.SUMMER]);
  });

  it('no salta de golpe tras un frame enorme (pestaña en segundo plano)', () => {
    const engine = new TimeEngine(bus, 0);
    engine.setSpeed(4);
    engine.update(60_000);
    expect(engine.time.totalMinutes).toBeLessThan(10);
  });

  it('exactMinuteOfDay incluye la fracción del minuto en curso', () => {
    const engine = new TimeEngine(bus, 100);
    engine.update(MINUTE_MS / 2);
    expect(engine.exactMinuteOfDay).toBeCloseTo(100.5, 1);
  });
});
