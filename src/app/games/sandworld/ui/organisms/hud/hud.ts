import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { SandworldService } from '../../../sandworld.service';
import { HudTopComponent } from '../hud-top/hud-top';
import { PlankBarComponent } from '../plank-bar/plank-bar';
import { SettingsMenuComponent } from '../settings-menu/settings-menu';
import { ChronicleBookComponent } from '../chronicle-book/chronicle-book';
import { IslandLabelComponent } from '../island-label/island-label';
import { SpeedControlComponent } from '../../molecules/speed-control/speed-control';
import { HUD_PLANKS } from './hud-planks';
import { TileTagComponent } from '../../molecules/tile-tag/tile-tag';
import { TPipe } from '../../../i18n/t.pipe';

/**
 * HUD completo sobre el mundo. Lee el estado del servicio y le devuelve las acciones del jugador.
 * El contenedor deja pasar los toques al canvas (pointer-events: none); solo las piezas los capturan.
 * Las tablas del estante y sus paneles salen del registro HUD_PLANKS.
 */
@Component({
  selector: 'sw-hud',
  standalone: true,
  imports: [
    NgComponentOutlet, HudTopComponent, PlankBarComponent, SettingsMenuComponent, ChronicleBookComponent,
    IslandLabelComponent, SpeedControlComponent, TileTagComponent, TPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-hud-top
      class="top"
      [time]="game.time()"
      [weather]="game.weather().look"
      [entries]="game.chronicleEntries()"
      [indicators]="game.indicatorValues()"
      (settings)="game.openMenu('settings')"
      (balance)="game.togglePanel('balance')"
      (chronicle)="game.openMenu('chronicle')"
    />

    @if (game.inspected(); as info) {
      <!-- Al tocar un tile: su bioma junto al dedo -->
      <sw-tile-tag class="tag" [style.left.px]="info.x" [style.top.px]="info.y" [label]="'biome.' + info.biomeKey | t" />
    }

    @if (game.islandLabel()) {
      <sw-island-label class="label" [level]="game.world.level" />
    }

    <div class="bottom">
      <div class="float">
        @if (openPanel(); as panel) {
          <!-- Envoltorio propio: los componentes creados dinámicamente no reciben los estilos de este HUD -->
          <div class="panel"><ng-container *ngComponentOutlet="panel" /></div>
        } @else {
          <sw-speed-control
            [speed]="game.speed()"
            [paused]="game.isPaused()"
            (cycle)="game.cycleSpeed()"
            (togglePause)="game.togglePause()"
          />
        }
      </div>
      <sw-plank-bar [planks]="planks" [panel]="game.panel()" [selectedSand]="game.selectedSand()" [strokeLeft]="game.strokeLeft()" (toggle)="game.togglePanel($event)" />
    </div>

    @switch (game.menu()) {
      @case ('settings') {
        <sw-settings-menu
          [lang]="game.lang()"
          (langChange)="game.setLang($event)"
          (close)="game.closeMenu()"
          (exit)="exit.emit()"
          (devAction)="game.closeMenu(); game.runDevAction($event)"
        />
      }
      @case ('chronicle') {
        <sw-chronicle-book [entries]="game.chronicleEntries()" (close)="game.closeMenu()" />
      }
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-top: max(8px, env(safe-area-inset-top));
      pointer-events: none;
      z-index: 10;
    }
    .top { padding: 0 8px; }
    .label {
      position: absolute;
      top: 132px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    /* La etiqueta del bioma sale encima del dedo (el HUD ocupa toda la pantalla, así que left/top son de pantalla) */
    /* translate (no transform): la animación de la etiqueta usa transform y lo pisaría */
    .tag { position: absolute; translate: -50% calc(-100% - 18px); pointer-events: none; z-index: 2; }
    .bottom { display: flex; flex-direction: column; gap: 6px; }
    /* Lo que flota sobre el estante: velocidad y pausa, o el panel abierto */
    .float {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0 8px;
    }
    .float > * { pointer-events: auto; }
    /* Los paneles ocupan todo el ancho; velocidad y pausa se quedan a la izquierda */
    .panel { align-self: stretch; }
    sw-plank-bar, sw-settings-menu, sw-chronicle-book { pointer-events: auto; }
  `,
})
export class HudComponent {
  protected readonly game = inject(SandworldService);
  readonly exit = output<void>();

  protected readonly planks = HUD_PLANKS;
  /** Componente del panel abierto, o null */
  protected readonly openPanel = computed(() => HUD_PLANKS.find(p => p.id === this.game.panel())?.panel ?? null);
}
