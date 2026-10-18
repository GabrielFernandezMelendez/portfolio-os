import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Graphics } from 'pixi.js';
import { SandworldService } from '../../sandworld.service';
import { PixiStage } from '../../rendering/pixi-stage';
import { SandworldLang } from '../../domain/models/settings.model';

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
  changeDetection: ChangeDetectionStrategy.OnPush, // todo el estado de la UI son signals
  providers: [SandworldService], // estado ligado a la vida del juego
})
export class SandworldComponent implements AfterViewInit, OnDestroy {
  /** Idioma inicial opcional que puede pasar el OS. Dentro del juego manda el selector de Ajustes. */
  readonly lang = input<SandworldLang | undefined>(undefined);

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  protected readonly game = inject(SandworldService);
  private readonly stage = new PixiStage();

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
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stage.destroy();
  }

  private async start(): Promise<void> {
    const app = await this.stage.mount(this.stageRef().nativeElement, (w, h) => this.center(w, h));
    if (!app) return; // se cerró antes de terminar de cargar

    this.drawPlaceholder(); // TEMPORAL: se sustituye por el terreno en el bloque 2
    this.center(app.screen.width, app.screen.height);
    this.game.isReady.set(true); // signal: OnPush refresca la vista solo
  }

  /** Pausa el render cuando la pestaña o la app pasan a segundo plano */
  private onVisibility = (): void => {
    if (document.hidden) this.stage.pause();
    else if (!this.game.isPaused()) this.stage.resume();
  };

  // ── TEMPORAL (bloque 1): rombo isométrico 8x8 para comprobar render, tamaño y centrado ──

  private readonly TW = 40;
  private readonly TH = 20;
  private readonly N = 8;

  private drawPlaceholder(): void {
    const g = new Graphics();
    for (let j = 0; j < this.N; j++) {
      for (let i = 0; i < this.N; i++) {
        const x = ((i - j) * this.TW) / 2;
        const y = ((i + j) * this.TH) / 2;
        const shade = (i + j) % 2 === 0 ? 0x55a847 : 0x4b9a40;
        g.poly([
          x,
          y - this.TH / 2,
          x + this.TW / 2,
          y,
          x,
          y + this.TH / 2,
          x - this.TW / 2,
          y,
        ]).fill(shade);
      }
    }
    this.stage.world.addChild(g);
  }

  private center(w: number, h: number): void {
    const scale = Math.max(1, Math.floor(((w - 24) / (this.N * this.TW)) * 2) / 2);
    const cy = ((this.N - 1) * this.TH) / 2;
    this.stage.world.scale.set(scale);
    this.stage.world.position.set(Math.round(w / 2), Math.round(h * 0.45 - cy * scale));
  }
}
