import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SandworldService } from '../../../sandworld.service';
import { SheetComponent } from '../../molecules/sheet/sheet';
import { IndicatorChipComponent } from '../../molecules/indicator-chip/indicator-chip';
import { BalanceSpeciesComponent } from '../../molecules/balance-species/balance-species';
import { BalanceChartComponent } from '../../molecules/balance-chart/balance-chart';
import { FoodWebComponent } from '../../molecules/food-web/food-web';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { TPipe } from '../../../i18n/t.pipe';

/** Pestañas del panel (las tres formas de ver el equilibrio; los testers dirán cuál se queda) */
const TABS = ['species', 'chart', 'web'] as const;
type BalanceTab = (typeof TABS)[number];

/** Última pestaña elegida (vive mientras el juego está abierto) */
const lastTab = signal<BalanceTab>('species');

/**
 * Panel de Equilibrio: el agua y la vegetación de la isla y, con pestañas, cómo van las especies (Especies), su
 * historia (Gráfico) y quién come a quién (Cadena). La pestaña elegida se recuerda mientras dura la partida.
 */
@Component({
  selector: 'sw-balance-panel',
  standalone: true,
  imports: [SheetComponent, IndicatorChipComponent, BalanceSpeciesComponent, BalanceChartComponent, FoodWebComponent, WoodButtonComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-sheet [heading]="'balance.title' | t" [closeLabel]="'chronicle.close' | t" (close)="game.closePanel()">
      <div class="tabs" role="tablist">
        @for (t of tabs; track t) {
          <button swWood class="tab" role="tab" [active]="tab() === t" [attr.aria-selected]="tab() === t" (click)="select(t)">
            {{ 'balance.tabs.' + t | t }}
          </button>
        }
      </div>
      @let v = game.balanceView();
      @switch (tab()) {
        @case ('species') {
          <div class="list">
            @for (ind of game.indicatorValues(); track ind.id) {
              <sw-indicator-chip [indicator]="ind" [labelled]="true" />
            }
          </div>
          @if (v && v.species.length) {
            <sw-balance-species [rows]="v.species" />
          } @else {
            <p class="hint">{{ 'balance.empty' | t }}</p>
          }
        }
        @case ('chart') {
          @if (v && v.species.length) {
            <sw-balance-chart [history]="v.history" />
          } @else {
            <p class="hint">{{ 'balance.empty' | t }}</p>
          }
        }
        @case ('web') {
          @if (v && v.species.length) {
            <sw-food-web [web]="v.web" />
          } @else {
            <p class="hint">{{ 'balance.empty' | t }}</p>
          }
        }
      }
    </sw-sheet>
  `,
  styles: `
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 8px; }
    .tab { min-height: 32px; padding: 0 2px; font-size: 10px; }
    .tab.active { color: var(--sw-accent); }
    .list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid rgb(74 44 23 / 0.25); }
    .hint { margin: 8px 2px 0; font: 400 13px/1.25 var(--sw-font-text); opacity: 0.85; }
  `,
})
export class BalancePanelComponent {
  protected readonly game = inject(SandworldService);
  protected readonly tabs = TABS;
  /** Se guarda fuera del componente: al cerrar y abrir el panel sigue en la misma pestaña */
  protected readonly tab = lastTab;

  protected select(t: BalanceTab): void {
    this.tab.set(t);
  }
}
