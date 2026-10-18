import { Injectable, signal } from '@angular/core';
import { DEFAULT_LANG, SandworldLang, SimSpeed, SIM_SPEEDS } from './domain/models/settings.model';

/**
 * Estado del juego que necesita la interfaz (HUD).
 * Se provee en el componente raíz (no en 'root'): nace al abrir el juego y muere al cerrarlo,
 * así no queda estado vivo en el portfolio y el juego se puede extraer tal cual.
 * El estado del mundo (celdas, agua, animales) NO va en signals: vive en arrays tipados del dominio.
 */
@Injectable()
export class SandworldService {
  readonly lang = signal<SandworldLang>(DEFAULT_LANG);
  readonly speed = signal<SimSpeed>(1);
  readonly isPaused = signal(false);
  readonly isReady = signal(false);

  setLang(lang: SandworldLang): void {
    this.lang.set(lang);
  }

  cycleSpeed(): void {
    const i = SIM_SPEEDS.indexOf(this.speed());
    this.speed.set(SIM_SPEEDS[(i + 1) % SIM_SPEEDS.length]);
  }

  pause(): void {
    this.isPaused.set(true);
  }

  resume(): void {
    this.isPaused.set(false);
  }
}
