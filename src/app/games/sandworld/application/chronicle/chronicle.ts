import { ChronicleDraft, ChronicleEntry, ChronicleParams, URGENT_TYPES } from '../../domain/models/chronicle.model';
import { GameTime } from '../../domain/models/time.model';
import { CHRONICLE_HISTORY, CHRONICLE_QUEUE_MAX, CHRONICLE_RELEASE_MS, CHRONICLE_STRIP_COUNT } from '../../config/chronicle.config';

interface Pending {
  entry: ChronicleEntry;
  priority: number;
  count: number;
  order: number;
}

/** Mensajes en la franja: los que rota más un margen para saber cuál es el último */
const STRIP_KEEP = CHRONICLE_STRIP_COUNT * 2;

const sameMessage = (a: { key: string; type: string; params?: ChronicleParams }, b: { key: string; type: string; params?: ChronicleParams }): boolean =>
  a.key === b.key && a.type === b.type && sameParams(a.params, b.params);

function sameParams(a: ChronicleParams = {}, b: ChronicleParams = {}): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
}

/**
 * Crónica de la isla. Dos vistas de lo mismo:
 * - Libro (`entries`): todo lo que pasa entra al momento, ordenado por el momento de juego en que ocurrió
 *   (el más reciente primero). Guarda los últimos HISTORY. Un mensaje igual al último del mismo día suma "×N".
 * - Franja (`strip`): con ritmo controlado para no saturar. Los mensajes esperan en una cola de prioridad y
 *   cada RELEASE_MS sale el de mayor prioridad (máx. 2 por minuto real); los iguales que esperan suman "×N".
 *   Catástrofes y cartas salen al instante. Si la cola se llena, la franja se salta los de menor prioridad.
 * El ritmo de la franja ya no afecta al libro: antes el libro recibía los mensajes al salir de la cola y se
 * mezclaban días (un aviso del día 3 podía quedar encima de uno del día 7).
 * El tiempo real se le pasa desde fuera (tick), así los tests no dependen del reloj.
 */
export class Chronicle {
  private readonly queue: Pending[] = [];
  private readonly history: ChronicleEntry[] = [];
  /** Minuto de juego de cada entrada del libro (mismo orden que history) */
  private readonly historyMinutes: number[] = [];
  private readonly released: ChronicleEntry[] = [];
  private nextReleaseAt = 0;
  private nextId = 1;
  /** La franja numera aparte: un mismo mensaje del libro puede salir dos veces a la franja (ya agrupado) */
  private nextStripId = 1;
  private order = 0;
  private version = 0;

  /** Cambia cada vez que cambia el libro o la franja: sirve para refrescar la interfaz solo cuando hace falta */
  get revision(): number {
    return this.version;
  }

  /** Libro: del más reciente al más antiguo, por tiempo de juego */
  get entries(): readonly ChronicleEntry[] {
    return this.history;
  }

  /** Franja: lo que ya ha salido de la cola, del último en salir al primero */
  get strip(): readonly ChronicleEntry[] {
    return this.released;
  }

  get pending(): number {
    return this.queue.length;
  }

  push(draft: ChronicleDraft, time: GameTime, nowMs: number): void {
    const entry = this.record(draft, time);
    if (URGENT_TYPES.includes(draft.type)) {
      this.release(entry, 1);
      return;
    }
    const same = this.queue.find(p => sameMessage(p.entry, entry));
    if (same) {
      same.count++;
      return;
    }
    this.queue.push({ entry, priority: draft.priority ?? 0, count: 1, order: this.order++ });
    if (this.queue.length > CHRONICLE_QUEUE_MAX) {
      this.sortQueue();
      this.queue.pop();                       // la franja se salta el de menor prioridad
    }
    this.tick(nowMs);
  }

  /** Llamar con frecuencia (cada frame o cada segundo) con el tiempo real actual */
  tick(nowMs: number): void {
    if (this.queue.length === 0 || nowMs < this.nextReleaseAt) return;
    this.sortQueue();
    const next = this.queue.shift()!;
    this.release(next.entry, next.count);
    this.nextReleaseAt = nowMs + CHRONICLE_RELEASE_MS;
  }

  /** Apunta el mensaje en el libro (o suma uno al último igual del mismo día) y devuelve su entrada */
  private record(draft: ChronicleDraft, time: GameTime): ChronicleEntry {
    const top = this.history[0];
    if (top && top.day === time.day && sameMessage(top, draft)) {
      const grown: ChronicleEntry = { ...top, count: top.count + 1 };
      this.history[0] = grown;
      this.version++;
      return grown;
    }
    const entry: ChronicleEntry = {
      id: this.nextId++,
      type: draft.type,
      key: draft.key,
      params: draft.params ?? {},
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      count: 1,
    };
    // Normalmente llega en orden y va arriba; si llegara uno atrasado, se coloca en su sitio
    let i = 0;
    while (i < this.historyMinutes.length && this.historyMinutes[i] > time.totalMinutes) i++;
    this.history.splice(i, 0, entry);
    this.historyMinutes.splice(i, 0, time.totalMinutes);
    if (this.history.length > CHRONICLE_HISTORY) {
      this.history.length = CHRONICLE_HISTORY;
      this.historyMinutes.length = CHRONICLE_HISTORY;
    }
    this.version++;
    return entry;
  }

  private sortQueue(): void {
    // Mayor prioridad primero; a igualdad, el más antiguo
    this.queue.sort((a, b) => b.priority - a.priority || a.order - b.order);
  }

  private release(entry: ChronicleEntry, count: number): void {
    this.released.unshift({ ...entry, id: this.nextStripId++, count });
    if (this.released.length > STRIP_KEEP) this.released.length = STRIP_KEEP;
    this.version++;
  }
}
