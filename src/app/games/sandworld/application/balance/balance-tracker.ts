import { DeathCause } from '../../domain/models/animal.model';
import { SPECIES_DEFS } from '../../config/species.config';
import {
  BALANCE_CROWDED, BALANCE_DAYS, BALANCE_EDGE_POP, BALANCE_EDGE_SATIETY, BALANCE_HUNGRY_SATIETY, BALANCE_PRESSED,
  BALANCE_PRESSURE_DAYS, BALANCE_RECENT_DAYS, BALANCE_ROOM, BALANCE_TREND, BALANCE_WEB_CARRION, BALANCE_WEB_PREY,
} from '../../config/balance.config';

/*
  Panel de Equilibrio: lo que el jugador ve de cómo van las especies. Lleva la cuenta de lo que pasa (muertes y su
  causa, quién caza a quién, nacimientos, llegadas y marchas), guarda una foto por especie cada amanecer (el gráfico) y
  lo traduce a palabras (estado y porqué), a barras y a la cadena alimentaria. No cambia la simulación: solo la lee.
  Todo sale de los datos de las especies, así una especie nueva aparece sola en el panel.
*/

/** Lo que el tracker necesita saber de cada especie ahora mismo */
export interface BalanceRow {
  readonly species: number;
  readonly population: number;
  /** Población que la isla puede alimentar ahora */
  readonly capacity: number;
  /** Hambre media (0..1, 1 = llenos), o null si no hay ninguno */
  readonly satiety: number | null;
}

/** Lo que el tracker apunta de las noticias de la fauna (un subconjunto de FaunaNews) */
export type BalanceNews =
  | { readonly type: 'died'; readonly species: number; readonly cause: DeathCause }
  | { readonly type: 'killed'; readonly species: number; readonly prey: number }
  | { readonly type: 'born'; readonly species: number; readonly count: number }
  | { readonly type: 'arrived'; readonly species: number }
  | { readonly type: 'left'; readonly species: number }
  | { readonly type: 'outbreak'; readonly species: number }
  | { readonly type: string; readonly species: number };

/** Cómo está una especie, en palabras (cada una tiene su texto en i18n: balance.mood.<mood>) */
export type BalanceMood =
  | 'thriving' | 'stable' | 'edge' | 'pressed' | 'hungry' | 'thirsty' | 'sick' | 'crowded' | 'gone' | 'left';

/** Gravedad: el color de la fila, de la barra del botón y la '!' */
export type BalanceSeverity = 'good' | 'warn' | 'bad' | 'none';

export interface SpeciesBalance {
  readonly species: number;
  readonly key: string;
  readonly population: number;
  /** ▲ 1, = 0, ▼ -1 (frente a hace unos días) */
  readonly trend: -1 | 0 | 1;
  readonly mood: BalanceMood;
  readonly severity: BalanceSeverity;
  /** Quien les aprieta (especie del depredador), si `mood` es 'pressed' */
  readonly by: number | null;
  /** Barra: cuánto se llena (0..1) y dónde va la raya de lo que la isla puede alimentar (0..1, o null) */
  readonly fill: number;
  readonly cap: number | null;
}

/** Algo que contó la crónica y se marca en el gráfico */
export interface BalanceMark {
  readonly day: number;
  readonly species: number;
  readonly kind: 'arrived' | 'last' | 'left' | 'outbreak';
}

export interface BalanceHistory {
  /** Un día por punto (el último es ahora mismo) */
  readonly days: readonly number[];
  readonly series: readonly { readonly species: number; readonly values: readonly number[] }[];
  readonly marks: readonly BalanceMark[];
}

/** Nodo de la cadena alimentaria: una especie o un recurso (plantas, peces, carroña) */
export interface WebNode {
  readonly id: string;
  /** Especie, o null si es un recurso */
  readonly species: number | null;
  readonly resource: 'plants' | 'fish' | 'carrion' | null;
  /** Fila (0 = recursos, abajo; más alto = más arriba en la cadena) y posición en la fila (0..1) */
  readonly level: number;
  readonly x: number;
  /** Tamaño relativo (0..1): cuántos hay frente a la especie más numerosa */
  readonly weight: number;
  /** Ya no queda ninguno */
  readonly gone: boolean;
}

/** Flecha de la cadena: de la comida (`from`) a quien se la come (`to`) */
export interface WebEdge {
  readonly from: string;
  readonly to: string;
  /** Presas cazadas en los últimos días (grosor) */
  readonly kills: number;
  /** Se cazan más de las que nacen: la presa no aguanta el ritmo (flecha roja) */
  readonly pressure: boolean;
  /** La comida ya no está en la isla (flecha a rayas) */
  readonly gone: boolean;
}

export interface FoodWeb {
  readonly nodes: readonly WebNode[];
  readonly edges: readonly WebEdge[];
  /** Filas que ocupa (para repartir la altura) */
  readonly levels: number;
}

export interface BalanceView {
  readonly species: readonly SpeciesBalance[];
  readonly history: BalanceHistory;
  readonly web: FoodWeb;
  /** Alguna especie está al borde (la '!' del botón) */
  readonly alert: boolean;
}

/** Lo que pasó en un día */
interface DayLog {
  day: number;
  deaths: Map<number, Map<DeathCause, number>>;
  /** 'depredador>presa' → presas */
  kills: Map<string, number>;
  births: Map<number, number>;
}

const SEVERITY_OF: Record<BalanceMood, BalanceSeverity> = {
  thriving: 'good', stable: 'good', edge: 'bad', pressed: 'warn', hungry: 'warn', thirsty: 'warn', sick: 'warn',
  crowded: 'warn', gone: 'none', left: 'none',
};

const newLog = (day: number): DayLog => ({ day, deaths: new Map(), kills: new Map(), births: new Map() });

export class BalanceTracker {
  /** Especies que han pisado la isla (las demás no salen: sin spoilers) */
  private readonly seen = new Set<number>();
  /** Una foto por amanecer: población de cada especie (por id) */
  private readonly history: { day: number; pop: number[] }[] = [];
  private readonly marks: BalanceMark[] = [];
  /** Hoy y los días anteriores (lo justo para tendencias y la presión de caza) */
  private readonly logs: DayLog[] = [newLog(1)];
  /** Cómo salió de la isla cada especie que ya no está: se fue o desapareció */
  private readonly exit = new Map<number, 'left' | 'gone'>();
  private lastPop: number[] = SPECIES_DEFS.map(() => 0);

  /** Apunta las noticias de la fauna de este momento (`day`: el día de juego) */
  record(news: readonly BalanceNews[], day: number): void {
    const log = this.today(day);
    for (const n of news) {
      switch (n.type) {
        case 'died': {
          const cause = (n as { cause: DeathCause }).cause;
          const m = log.deaths.get(n.species) ?? new Map<DeathCause, number>();
          m.set(cause, (m.get(cause) ?? 0) + 1);
          log.deaths.set(n.species, m);
          break;
        }
        case 'killed': {
          const k = `${n.species}>${(n as { prey: number }).prey}`;
          log.kills.set(k, (log.kills.get(k) ?? 0) + 1);
          break;
        }
        case 'born':
          log.births.set(n.species, (log.births.get(n.species) ?? 0) + ((n as { count: number }).count || 1));
          break;
        case 'arrived':
          this.seen.add(n.species);
          this.exit.delete(n.species);
          this.mark(day, n.species, 'arrived');
          break;
        case 'left':
          this.exit.set(n.species, 'left');
          this.mark(day, n.species, 'left');
          break;
        case 'outbreak':
          this.mark(day, n.species, 'outbreak');
          break;
      }
    }
  }

  /** Amanecer: foto del día para el gráfico, y se marca la especie que se ha quedado sin nadie */
  dawn(day: number, rows: readonly BalanceRow[]): void {
    const pop = SPECIES_DEFS.map(s => rows.find(r => r.species === s.id)?.population ?? 0);
    for (const s of SPECIES_DEFS) {
      if (pop[s.id] > 0) {
        this.seen.add(s.id);
        this.exit.delete(s.id);
      } else if (this.lastPop[s.id] > 0 && this.exit.get(s.id) !== 'left') {
        this.exit.set(s.id, 'gone');
        this.mark(day, s.id, 'last');
      }
    }
    this.lastPop = pop;
    const last = this.history[this.history.length - 1];
    if (last?.day === day) last.pop = pop;
    else this.history.push({ day, pop });
    while (this.history.length > BALANCE_DAYS) this.history.shift();
    const first = this.history[0].day;
    while (this.marks.length && this.marks[0].day < first) this.marks.shift();
    this.today(day);
  }

  /** Todo lo que enseña el panel, con la foto de ahora (`rows`) como último punto */
  view(day: number, rows: readonly BalanceRow[]): BalanceView {
    for (const r of rows) if (r.population > 0) this.seen.add(r.species);
    const species = SPECIES_DEFS.filter(s => this.seen.has(s.id)).map(s => this.speciesBalance(s.id, rows));
    return {
      species,
      history: this.historyView(day, rows),
      web: this.foodWeb(rows),
      alert: species.some(s => s.severity === 'bad'),
    };
  }

  // ── Estado de cada especie ──

  private speciesBalance(id: number, rows: readonly BalanceRow[]): SpeciesBalance {
    const s = SPECIES_DEFS[id];
    const row = rows.find(r => r.species === id);
    const pop = row?.population ?? 0;
    const capacity = row?.capacity ?? 0;
    const scale = Math.max(pop, capacity, 1) * 1.25;
    const bar = { fill: Math.min(1, pop / scale), cap: capacity > 0 ? Math.min(1, capacity / scale) : null };
    if (pop === 0) {
      const mood: BalanceMood = this.exit.get(id) === 'left' ? 'left' : 'gone';
      return { species: id, key: s.key, population: 0, trend: 0, mood, severity: 'none', by: null, ...bar };
    }
    const recent = this.logs.slice(-(BALANCE_RECENT_DAYS + 1));
    const deaths = (cause: DeathCause) => recent.reduce((n, l) => n + (l.deaths.get(id)?.get(cause) ?? 0), 0);
    // Quién le caza más
    const hunters = new Map<number, number>();
    for (const l of recent) {
      for (const [k, n] of l.kills) {
        const [pred, prey] = k.split('>').map(Number);
        if (prey === id) hunters.set(pred, (hunters.get(pred) ?? 0) + n);
      }
    }
    let by: number | null = null, hunted = 0;
    for (const [pred, n] of hunters) {
      if (n > hunted) {
        by = pred;
        hunted = n;
      }
    }
    const sat = row?.satiety ?? null;
    let mood: BalanceMood;
    if (capacity > 0 && pop > capacity * BALANCE_CROWDED) mood = 'crowded';
    else if (deaths('disease') > 0) mood = 'sick';
    else if (by !== null && hunted >= Math.max(1, pop * BALANCE_PRESSED)) mood = 'pressed';
    else if (deaths('starvation') > 0 || (sat !== null && sat < BALANCE_HUNGRY_SATIETY)) mood = 'hungry';
    else if (deaths('dehydration') > 0) mood = 'thirsty';
    else mood = 'stable';
    const trend = this.trend(id, pop);
    if (mood === 'stable' && trend > 0 && pop < Math.max(capacity, 1) * BALANCE_ROOM) mood = 'thriving';
    // Al borde: quedan muy pocos (o menos que su manada mínima) o se mueren de hambre
    const min = s.keepMin ? s.herd.min : 0;
    const edge = pop <= BALANCE_EDGE_POP || pop < min || (sat !== null && sat < BALANCE_EDGE_SATIETY);
    let severity = SEVERITY_OF[mood];
    if (edge) {
      severity = 'bad';
      if (mood === 'stable' || mood === 'thriving') mood = 'edge';
    }
    return { species: id, key: s.key, population: pop, trend, mood, severity, by: mood === 'pressed' ? by : null, ...bar };
  }

  /** Frente a la foto de hace BALANCE_RECENT_DAYS amaneceres (o la más vieja que haya) */
  private trend(id: number, pop: number): -1 | 0 | 1 {
    if (!this.history.length) return 0;
    const past = this.history[Math.max(0, this.history.length - BALANCE_RECENT_DAYS)].pop[id];
    if (past === 0) return pop > 0 ? 1 : 0;
    const change = (pop - past) / past;
    return change > BALANCE_TREND ? 1 : change < -BALANCE_TREND ? -1 : 0;
  }

  // ── Gráfico ──

  private historyView(day: number, rows: readonly BalanceRow[]): BalanceHistory {
    const points = this.history.map(h => ({ day: h.day, pop: h.pop }));
    // El último punto es ahora mismo (si el amanecer de hoy ya está, se sustituye)
    const now = SPECIES_DEFS.map(s => rows.find(r => r.species === s.id)?.population ?? 0);
    if (points.length && points[points.length - 1].day === day) points[points.length - 1] = { day, pop: now };
    else points.push({ day, pop: now });
    while (points.length > BALANCE_DAYS) points.shift();
    const series = SPECIES_DEFS.filter(s => this.seen.has(s.id)).map(s => ({ species: s.id, values: points.map(p => p.pop[s.id] ?? 0) }));
    return { days: points.map(p => p.day), series, marks: this.marks.filter(m => m.day >= points[0].day) };
  }

  // ── Cadena alimentaria ──

  private foodWeb(rows: readonly BalanceRow[]): FoodWeb {
    const shown = SPECIES_DEFS.filter(s => this.seen.has(s.id));
    const pop = (id: number) => rows.find(r => r.species === id)?.population ?? 0;
    const window = this.logs.slice(-BALANCE_PRESSURE_DAYS);
    const kills = (pred: number, prey: number) => window.reduce((n, l) => n + (l.kills.get(`${pred}>${prey}`) ?? 0), 0);
    const births = (id: number) => window.reduce((n, l) => n + (l.births.get(id) ?? 0), 0);
    const edges: WebEdge[] = [];
    const resources = new Set<'plants' | 'fish' | 'carrion'>();
    const id = (sp: number) => `s${sp}`;
    for (const s of shown) {
      if (s.diets.some(d => d !== 'carnivore')) {
        resources.add('plants');
        edges.push({ from: 'plants', to: id(s.id), kills: 0, pressure: false, gone: false });
      }
      if (s.fishing) {
        resources.add('fish');
        edges.push({ from: 'fish', to: id(s.id), kills: 0, pressure: false, gone: false });
      }
      if (!s.predator) continue;
      if (s.predator.carrion >= BALANCE_WEB_CARRION) {
        resources.add('carrion');
        edges.push({ from: 'carrion', to: id(s.id), kills: 0, pressure: false, gone: false });
      }
      for (const [preyKey, weight] of Object.entries(s.predator.prey)) {
        const prey = SPECIES_DEFS.find(p => p.key === preyKey);
        if (!prey || !this.seen.has(prey.id) || weight < BALANCE_WEB_PREY) continue;
        const k = kills(s.id, prey.id);
        edges.push({ from: id(prey.id), to: id(s.id), kills: k, pressure: k > 0 && k > births(prey.id), gone: pop(prey.id) === 0 });
      }
    }
    // Filas: los recursos abajo; cada especie, una por encima de lo más alto que come. Si dos se comen entre sí
    // (humanos y goblins), esa flecha no cuenta para subir (si no, subirían sin fin)
    const level = new Map<string, number>();
    for (const r of resources) level.set(r, 0);
    for (const s of shown) level.set(id(s.id), 1);
    const mutual = (e: WebEdge) => edges.some(f => f.from === e.to && f.to === e.from);
    for (let pass = 0; pass < shown.length; pass++) {
      let changed = false;
      for (const s of shown) {
        let lv = 1;
        for (const e of edges) if (e.to === id(s.id) && !mutual(e)) lv = Math.max(lv, (level.get(e.from) ?? 0) + 1);
        if (lv !== level.get(id(s.id))) {
          level.set(id(s.id), lv);
          changed = true;
        }
      }
      if (!changed) break;
    }
    // Posición en la fila: los recursos repartidos; cada especie, cerca de lo que come (media de sus comidas)
    const x = new Map<string, number>();
    const order: ('plants' | 'carrion' | 'fish')[] = ['plants', 'carrion', 'fish'];
    const res = order.filter(r => resources.has(r));
    res.forEach((r, i) => x.set(r, (i + 0.5) / res.length));
    const levels = Math.max(1, ...level.values());
    for (let lv = 1; lv <= levels; lv++) {
      const row = shown.filter(s => level.get(id(s.id)) === lv).map(s => {
        const from = edges.filter(e => e.to === id(s.id) && x.has(e.from)).map(e => x.get(e.from)!);
        return { s, at: from.length ? from.reduce((a, b) => a + b, 0) / from.length : 0.5 };
      });
      row.sort((a, b) => a.at - b.at || a.s.id - b.s.id);
      row.forEach((r, i) => x.set(id(r.s.id), (i + 0.5) / row.length));
    }
    const most = Math.max(1, ...shown.map(s => pop(s.id)));
    const nodes: WebNode[] = [
      ...res.map(r => ({ id: r, species: null, resource: r, level: 0, x: x.get(r)!, weight: 1, gone: false })),
      ...shown.map(s => ({
        id: id(s.id), species: s.id, resource: null, level: level.get(id(s.id))!, x: x.get(id(s.id))!,
        weight: pop(s.id) / most, gone: pop(s.id) === 0,
      })),
    ];
    return { nodes, edges, levels };
  }

  // ── Utilidades ──

  private today(day: number): DayLog {
    let log = this.logs[this.logs.length - 1];
    if (log.day !== day) {
      log = newLog(day);
      this.logs.push(log);
      while (this.logs.length > Math.max(BALANCE_PRESSURE_DAYS, BALANCE_RECENT_DAYS + 1)) this.logs.shift();
    }
    return log;
  }

  private mark(day: number, species: number, kind: BalanceMark['kind']): void {
    if (this.marks.some(m => m.day === day && m.species === species && m.kind === kind)) return;
    this.marks.push({ day, species, kind });
  }
}
