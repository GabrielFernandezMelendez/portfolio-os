/**
 * Qué chunks ha descubierto el jugador. Lo demás existe (el generador es determinista)
 * pero sigue bajo las nubes. Se guardará con la partida en la fase 5.
 */
export class ExplorationMap {
  private readonly revealed = new Set<string>(['0,0']);

  private static key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  isRevealed(cx: number, cy: number): boolean {
    return this.revealed.has(ExplorationMap.key(cx, cy));
  }

  /** Marca el chunk como descubierto. Devuelve false si ya lo estaba. */
  reveal(cx: number, cy: number): boolean {
    const k = ExplorationMap.key(cx, cy);
    if (this.revealed.has(k)) return false;
    this.revealed.add(k);
    return true;
  }

  /** Chunks descubiertos, en orden de descubrimiento */
  list(): { cx: number; cy: number }[] {
    return [...this.revealed].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    });
  }
}
