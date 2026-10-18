import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  effect, inject, input, output, viewChild,
} from '@angular/core';
import { SandworldService } from '../../sandworld.service';
import { SandworldRuntime } from '../../sandworld-runtime';
import { SandworldLang } from '../../domain/models/settings.model';
import { Translator } from '../../i18n/translator';
import { SETTINGS_STORAGE } from '../../infrastructure/settings-storage.token';
import { LocalSettingsStorage } from '../../infrastructure/local-settings-storage';
import { HudComponent } from '../organisms/hud/hud';
import { FRAME_VARS } from '../atoms/frame/pixel-frames';

/**
 * Punto de entrada único del juego.
 * El OS (o, en el futuro, la app de Ionic) solo necesita montar <app-sandworld (exit)="..." />.
 * Nada de esta carpeta importa del portfolio.
 */
@Component({
  selector: 'app-sandworld',
  standalone: true,
  imports: [HudComponent],
  templateUrl: './sandworld.html',
  styleUrl: './sandworld.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Marcos pixel de madera y pergamino como variables CSS (ver pixel-frames.ts)
  host: { '[style]': 'frameVars' },
  providers: [
    SandworldService,                       // estado ligado a la vida del juego
    Translator,
    { provide: SETTINGS_STORAGE, useClass: LocalSettingsStorage },
  ],
})
export class SandworldComponent implements AfterViewInit, OnDestroy {

  /** Idioma que propone el OS. Solo se usa si el jugador no ha elegido otro en Ajustes. */
  readonly lang = input<SandworldLang | undefined>(undefined);
  /** El jugador pulsó "Salir" en Ajustes: quien monta el juego decide cómo cerrarlo */
  readonly exit = output<void>();

  protected readonly frameVars = FRAME_VARS;

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  protected readonly game = inject(SandworldService);
  private readonly runtime = new SandworldRuntime(this.game.engine, this.game.world, {
    frame: now => this.game.tick(now),
    islandTap: () => this.zone.run(() => this.game.showIslandLabel()),
    pour: {
      begin: () => this.game.beginStroke(),
      at: (gx, gy, s) => this.game.pourAt(gx, gy, s),
      end: () => this.game.endStroke(),
      color: () => this.game.sandColor(),
    },
  });

  constructor() {
    effect(() => {
      const l = this.lang();
      if (l) this.game.suggestLang(l);
    });
    // Con una arena elegida, 1 dedo es pincel; sin arena, mueve la cámara
    effect(() => this.runtime.setBrushEnabled(this.game.selectedSand() !== null));
    // Chunk descubierto → emerge de las nubes
    this.game.events.on('chunkRevealed', c => this.runtime.showChunk(c.cx, c.cy));
    // Terreno cambiado (desprendimientos, vertidos) → re-horneado
    this.game.events.on('terrainChanged', cs => this.runtime.markDirty(cs));
  }

  ngAfterViewInit(): void {
    // Pixi corre su propio bucle; fuera de la zona de Angular para no disparar detección de cambios en cada frame
    this.zone.runOutsideAngular(() => this.start());
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.runtime.destroy();
  }

  private async start(): Promise<void> {
    const ok = await this.runtime.mount(this.stageRef().nativeElement);
    if (ok) this.zone.run(() => this.game.start());
  }

  /** Detiene el render y el tiempo cuando la pestaña o la app pasan a segundo plano */
  private onVisibility = (): void => {
    if (document.hidden) this.runtime.pause();
    else this.runtime.resume();
  };
}
