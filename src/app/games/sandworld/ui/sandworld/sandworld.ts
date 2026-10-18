import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  computed, effect, inject, input, viewChild,
} from '@angular/core';
import { SandworldService } from '../../sandworld.service';
import { SandworldRuntime } from '../../sandworld-runtime';
import { SandworldLang, SimSpeed } from '../../domain/models/settings.model';

/** TEMPORAL (hasta el HUD del bloque 4) */
const SEASON_NAMES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];

/**
 * Punto de entrada único del juego.
 * El OS (o, en el futuro, la app de Ionic) solo necesita montar <app-sandworld />.
 * Nada de esta carpeta importa del portfolio.
 */
@Component({
  selector: 'app-sandworld',
  standalone: true,
  templateUrl: './sandworld.html',
  styleUrl: './sandworld.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SandworldService],          // estado ligado a la vida del juego
})
export class SandworldComponent implements AfterViewInit, OnDestroy {

  /** Idioma inicial opcional que puede pasar el OS. Dentro del juego manda el selector de Ajustes. */
  readonly lang = input<SandworldLang | undefined>(undefined);

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  protected readonly game = inject(SandworldService);
  private readonly runtime = new SandworldRuntime(this.game.engine);

  /** TEMPORAL: línea de depuración con el tiempo de juego (la sustituye el HUD en el bloque 4) */
  protected readonly debugLine = computed(() => {
    const t = this.game.time();
    const hh = String(t.hour).padStart(2, '0');
    const mm = String(t.minute).padStart(2, '0');
    const speed = this.game.isPaused() ? 'pausa' : `x${this.game.speed()}`;
    return `Año ${t.year} · ${SEASON_NAMES[t.season]} · Día ${t.dayOfSeason} · ${hh}:${mm} · ${speed}`;
  });

  constructor() {
    effect(() => {
      const l = this.lang();
      if (l) this.game.setLang(l);
    });
  }

  ngAfterViewInit(): void {
    // Pixi corre su propio bucle; fuera de la zona de Angular para no disparar detección de cambios en cada frame
    this.zone.runOutsideAngular(() => this.start());
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('keydown', this.onKey);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('keydown', this.onKey);
    this.runtime.destroy();
  }

  private async start(): Promise<void> {
    const ok = await this.runtime.mount(this.stageRef().nativeElement);
    if (ok) this.zone.run(() => this.game.isReady.set(true));
  }

  /** Detiene el render y el tiempo cuando la pestaña o la app pasan a segundo plano */
  private onVisibility = (): void => {
    if (document.hidden) this.runtime.pause();
    else this.runtime.resume();
  };

  /** TEMPORAL: espacio pausa, 1/2/4 cambian la velocidad (los botones de madera llegan en el bloque 4) */
  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable]')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.zone.run(() => this.game.togglePause());
    } else if (e.key === '1' || e.key === '2' || e.key === '4') {
      this.zone.run(() => this.game.setSpeed(Number(e.key) as SimSpeed));
    }
  };
}
