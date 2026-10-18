import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SandworldService } from '../../../sandworld.service';
import { SheetComponent } from '../../molecules/sheet/sheet';
import { IndicatorChipComponent } from '../../molecules/indicator-chip/indicator-chip';
import { TPipe } from '../../../i18n/t.pipe';

/** Panel de Equilibrio: todos los indicadores registrados, con nombre y porcentaje */
@Component({
  selector: 'sw-balance-panel',
  standalone: true,
  imports: [SheetComponent, IndicatorChipComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-sheet [heading]="'balance.title' | t" [closeLabel]="'chronicle.close' | t" (close)="game.closePanel()">
      <div class="list">
        @for (ind of game.indicatorValues(); track ind.id) {
          <sw-indicator-chip [indicator]="ind" [labelled]="true" />
        }
      </div>
      <p class="hint">{{ 'balance.hint' | t }}</p>
    </sw-sheet>
  `,
  styles: `
    .list { display: flex; flex-direction: column; gap: 8px; }
    .hint { margin: 8px 2px 0; font-size: 13px; opacity: 0.85; }
  `,
})
export class BalancePanelComponent {
  protected readonly game = inject(SandworldService);
}
