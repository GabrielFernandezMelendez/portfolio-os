import { CALENDAR, GameTime, SeasonId } from '../../domain/models/time.model';
import { CLEAR_WEATHER, WeatherEffects, WeatherEventDef, WeatherState } from '../../domain/models/weather.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { WEATHER_EVENTS } from '../../config/weather.config';
import { DROUGHT_DAYS } from '../../config/climate.config';

/** Un episodio previsto: fenómeno, minuto de inicio y fin (minutos totales de juego) e intensidad */
interface Episode {
  readonly def: WeatherEventDef;
  readonly start: number;
  readonly end: number;
  readonly intensity: number;
}

/** Algo que contar en la crónica */
export type WeatherNews =
  | { readonly type: 'start' | 'end'; readonly key: string; readonly look: string }
  | { readonly type: 'drought'; readonly days: number };

const SEASON_MINUTES = CALENDAR.DAYS_PER_SEASON * CALENDAR.MINUTES_PER_DAY;

/**
 * El tiempo atmosférico. Al empezar cada estación reparte al azar los episodios de cada fenómeno
 * del registro (cuántos, cuándo, cuánto duran y con qué fuerza); nunca se solapan dos episodios.
 * Cada minuto aplica el episodio activo al mundo y avisa de los cambios (empieza, escampa, sequía).
 */
export class WeatherSystem {
  private plan: Episode[] = [];
  private state: WeatherState = CLEAR_WEATHER;
  private planned = false;
  private lastBreak = 0;
  private droughtWarned = false;

  constructor(
    private readonly world: WeatherEffects,
    private readonly random: RandomSource,
    private readonly events: readonly WeatherEventDef[] = WEATHER_EVENTS,
  ) {}

  get current(): WeatherState {
    return this.state;
  }

  /** Días sin que nada rompa la sequía (para la sequedad del fuego) */
  droughtDays(now: number): number {
    return (now - this.lastBreak) / CALENDAR.MINUTES_PER_DAY;
  }

  /** Reparte los episodios de la estación que empieza en `seasonStart` (minutos totales) */
  planSeason(season: SeasonId, seasonStart: number, from = seasonStart): void {
    this.planned = true;
    this.plan = this.plan.filter(e => e.end > from);
    const candidates: Episode[] = [];
    for (const def of this.events) {
      const [min, max] = def.episodes[season];
      const count = min + Math.floor(this.random.next() * (max - min + 1));
      for (let i = 0; i < count; i++) {
        const length = Math.round(this.between(def.hours) * 60);
        const start = seasonStart + Math.floor(this.random.next() * (SEASON_MINUTES - length));
        if (start < from) continue;
        candidates.push({ def, start, end: start + length, intensity: this.between(def.intensity) });
      }
    }
    // Sin solapes: si dos episodios coinciden, se queda el primero
    candidates.sort((a, b) => a.start - b.start);
    for (const e of candidates) {
      if (this.plan.every(p => e.end <= p.start || e.start >= p.end)) this.plan.push(e);
    }
    this.plan.sort((a, b) => a.start - b.start);
  }

  /** TEMPORAL (modo desarrollo): un episodio del fenómeno `key` que empieza ya (3 h, intensidad 0,8) */
  forceNow(key: string, now: number): void {
    const def = this.events.find(e => e.key === key);
    if (!def) return;
    const episode: Episode = { def, start: now + 1, end: now + 1 + 180, intensity: 0.8 };
    this.plan = this.plan.filter(e => e.end <= episode.start || e.start >= episode.end);
    this.plan.push(episode);
    this.plan.sort((a, b) => a.start - b.start);
  }

  /** Un minuto de juego. Devuelve lo que haya que contar en la crónica. */
  minute(time: GameTime): WeatherNews[] {
    const news: WeatherNews[] = [];
    const now = time.totalMinutes;
    // Partida empezada a mitad de estación: se reparte lo que queda de ella
    if (!this.planned) this.planSeason(time.season, now - ((time.dayOfSeason - 1) * CALENDAR.MINUTES_PER_DAY + time.minuteOfDay), now);

    const episode = this.plan.find(e => now >= e.start && now < e.end) ?? null;
    const before = this.state;
    if (episode) {
      const look = episode.def.apply(this.world, episode.intensity);
      this.state = { key: episode.def.key, intensity: episode.intensity, look, gloom: episode.def.gloom * episode.intensity };
      if (episode.def.breaksDrought) {
        this.lastBreak = now;
        this.droughtWarned = false;
      }
    } else {
      this.state = CLEAR_WEATHER;
    }
    if (before.key !== this.state.key) {
      if (before.key) news.push({ type: 'end', key: before.key, look: before.look });
      if (this.state.key) news.push({ type: 'start', key: this.state.key, look: this.state.look });
    }
    // Sequía: muchos días de verano sin que nada la rompa
    const dry = (now - this.lastBreak) / CALENDAR.MINUTES_PER_DAY;
    if (time.season === 1 && dry >= DROUGHT_DAYS && !this.droughtWarned) {
      this.droughtWarned = true;
      news.push({ type: 'drought', days: Math.floor(dry) });
    }
    return news;
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.random.next() * (max - min);
  }
}
