import { ChronicleDraft, ChronicleEntry, ChronicleParams, URGENT_TYPES } from '../../domain/models/chronicle.model';
import { GameTime } from '../../domain/models/time.model';
import { CHRONICLE_HISTORY, CHRONICLE_QUEUE_MAX, CHRONICLE_RELEASE_MS } from '../../config/chronicle.config';

interface Pending {
  draft: ChronicleDraft;
  time: GameTime;
  count: number;
  order: number;
}

const sameMessage = (a: ChronicleDraft, b: ChronicleDraft): boolean =>
  a.key === b.key && a.type === b.type && sameParams(a.params, b.params);

function sameParams(a: ChronicleParams = {}, b: ChronicleParams = {}): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
}

/**
 * Crónica de la isla con ritmo controlado.
 * - Los mensajes entran en una cola de prioridad; cada RELEASE_MS sale el de mayor prioridad (máx. 2 por minuto).
 * - Un mensaje igual a otro que ya espera no se duplica: suma su contador ("×3").
 * - Catástrofes y cartas se publican al instante.
 * - Se guardan los últimos HISTORY mensajes, el más reciente primero.
 * El tiempo real se le pasa desde fuera (tick), así los tests no dependen del reloj.
 */
export class Chronicle {
  private readonly queue: Pending[] = [];
  private readonly history: ChronicleEntry[] = [];
  private nextReleaseAt = 0;
  private nextId = 1;
  private order = 0;
  private version = 0;

  /** Cambia cada vez que se publica algo: sirve para refrescar la interfaz solo cuando hace falta */
  get revision(): number {
    return this.version;
  }

  /** Publicados, del más reciente al más antiguo */
  get entries(): readonly ChronicleEntry[] {
    return this.history;
  }

  get pending(): number {
    return this.queue.length;
  }

  push(draft: ChronicleDraft, time: GameTime, nowMs: number): void {
    if (URGENT_TYPES.includes(draft.type)) {
      this.publish(draft, time, 1);
      return;
    }
    const same = this.queue.find(p => sameMessage(p.draft, draft));
    if (same) {
      same.count++;
      return;
    }
    this.queue.push({ draft, time, count: 1, order: this.order++ });
    if (this.queue.length > CHRONICLE_QUEUE_MAX) {
      this.sortQueue();
      this.queue.pop();                       // fuera el de menor prioridad
    }
    this.tick(nowMs);
  }

  /** Llamar con frecuencia (cada frame o cada segundo) con el tiempo real actual */
  tick(nowMs: number): void {
    if (this.queue.length === 0 || nowMs < this.nextReleaseAt) return;
    this.sortQueue();
    const next = this.queue.shift()!;
    this.publish(next.draft, next.time, next.count);
    this.nextReleaseAt = nowMs + CHRONICLE_RELEASE_MS;
  }

  private sortQueue(): void {
    // Mayor prioridad primero; a igualdad, el más antiguo
    this.queue.sort((a, b) => (b.draft.priority ?? 0) - (a.draft.priority ?? 0) || a.order - b.order);
  }

  private publish(draft: ChronicleDraft, time: GameTime, count: number): void {
    this.history.unshift({
      id: this.nextId++,
      type: draft.type,
      key: draft.key,
      params: draft.params ?? {},
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      count,
    });
    if (this.history.length > CHRONICLE_HISTORY) this.history.length = CHRONICLE_HISTORY;
    this.version++;
  }
}
