import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GameTime } from '../../../domain/models/time.model';
import { ChronicleEntry } from '../../../domain/models/chronicle.model';
import { IndicatorValue } from '../../../application/indicators/indicator-registry';
import { TimePlateComponent } from '../../molecules/time-plate/time-plate';
import { ChronicleStripComponent } from '../../molecules/chronicle-strip/chronicle-strip';
import { IndicatorChipComponent } from '../../molecules/indicator-chip/indicator-chip';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { WoodFrameComponent } from '../../atoms/frame/frame';
import { IconComponent } from '../../atoms/icon/icon';
import { TPipe } from '../../../i18n/t.pipe';

/** Parte superior: hora · tablón de anuncios · ajustes. Debajo, a la derecha, los indicadores. */
@Component({
  selector: 'sw-hud-top',
  standalone: true,
  imports: [TimePlateComponent, ChronicleStripComponent, IndicatorChipComponent, WoodButtonComponent, WoodFrameComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <sw-time-plate class="plate" [time]="time()" />
      <sw-chronicle-strip class="board" [entries]="entries()" (open)="chronicle.emit()" />
      <button swWood class="gear" (click)="settings.emit()" [attr.aria-label]="'hud.settings' | t">
        <sw-icon name="gear" [scale]="2" />
      </button>
    </div>
    @if (indicators().length) {
      <div swWoodFrame class="indicators" (click)="balance.emit()">
        @for (ind of indicators(); track ind.id) {
          <sw-indicator-chip [indicator]="ind" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      pointer-events: none;
    }
    .row {
      display: flex;
      align-items: stretch;
      gap: 4px;
      width: 100%;
      height: 58px;
      pointer-events: auto;
    }
    .plate { flex: none; }
    .board { flex: 1; }
    .gear { flex: none; width: 44px; height: auto; padding: 0; }
    .indicators {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 2px;
      cursor: pointer;
      pointer-events: auto;
    }
  `,
})
export class HudTopComponent {
  readonly time = input.required<GameTime>();
  readonly entries = input.required<readonly ChronicleEntry[]>();
  readonly indicators = input.required<readonly IndicatorValue[]>();
  readonly settings = output<void>();
  readonly balance = output<void>();
  readonly chronicle = output<void>();
}
