export type Listener<T> = (payload: T) => void;

/**
 * Emisor de eventos tipado y sin dependencias.
 * Une partes del juego que no deben conocerse entre sí (el motor de tiempo no sabe que existe la crónica).
 */
export class EventBus<E extends object> {
  private readonly listeners = new Map<keyof E, Set<Listener<never>>>();

  /** Se suscribe a un evento. Devuelve la función para darse de baja. */
  on<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of set) (fn as Listener<E[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
