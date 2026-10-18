import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  effect, inject, input, viewChild,
} from '@angular/core';
import { SandworldService } from '../../sandworld.service';
import { PixiStage } from '../../rendering/pixi-stage';
import { TerrainLayer } from '../../rendering/terrain/terrain-layer';
import { BAKE_HEIGHT, BAKE_ORIGIN_Y, BAKE_WIDTH } from '../../rendering/terrain/chunk-baker';
import { generateChunk } from '../../application/world/chunk-generator';
import { computeClimate } from '../../application/world/climate';
import { DEFAULT_SEED } from '../../config/world.config';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SandworldService],          // estado ligado a la vida del juego
})
export class SandworldComponent implements AfterViewInit, OnDestroy {

  /** Idioma inicial opcional que puede pasar el OS. Dentro del juego manda el selector de Ajustes. */
  readonly lang = input<SandworldLang | undefined>(undefined);

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  protected readonly game = inject(SandworldService);
  private readonly stage = new PixiStage();
  private terrain: TerrainLayer | null = null;

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
    this.terrain?.destroy();
    this.terrain = null;
    this.stage.destroy();
  }

  private async start(): Promise<void> {
    const app = await this.stage.mount(this.stageRef().nativeElement, (w, h) => this.center(w, h));
    if (!app) return;                       // se cerró antes de terminar de cargar

    // Chunk inicial (0,0): física → clima → horneado
    const chunk = generateChunk(DEFAULT_SEED, 0, 0);
    computeClimate(chunk, DEFAULT_SEED);
    this.terrain = new TerrainLayer(DEFAULT_SEED);
    this.terrain.render(chunk);
    this.stage.world.addChild(this.terrain.view);

    this.center(app.screen.width, app.screen.height);
    this.zone.run(() => this.game.isReady.set(true));
  }

  /** Pausa el render cuando la pestaña o la app pasan a segundo plano */
  private onVisibility = (): void => {
    if (document.hidden) this.stage.pause();
    else if (!this.game.isPaused()) this.stage.resume();
  };

  /**
   * Encaje provisional: escala entera o de medio paso que quepa a lo ancho y centra la isla.
   * En el bloque 3 lo sustituye la cámara (arrastre con dos dedos, zoom y scroll por bordes).
   */
  private center(w: number, h: number): void {
    const scale = Math.max(1, Math.floor(((w - 24) / BAKE_WIDTH) * 2) / 2);
    // Centro vertical del dibujo horneado, en coordenadas del mundo
    const midY = BAKE_HEIGHT / 2 - BAKE_ORIGIN_Y;
    this.stage.world.scale.set(scale);
    this.stage.world.position.set(Math.round(w / 2), Math.round(h * 0.45 - midY * scale));
  }
}
