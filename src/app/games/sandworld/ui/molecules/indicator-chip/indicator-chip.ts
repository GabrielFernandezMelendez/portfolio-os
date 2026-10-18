import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IndicatorValue } from '../../../application/indicators/indicator-registry';
import { IconComponent } from '../../atoms/icon/icon';
import { BarComponent } from '../../atoms/bar/bar';
import { TPipe } from '../../../i18n/t.pipe';
import { Translator } from '../../../i18n/translator';

/** Icono + barra. Con `labelled` muestra además el nombre y el porcentaje (panel de Equilibrio). */
@Component({
  selector: 'sw-indicator-chip',
  standalone: true,
  imports: [IconComponent, BarComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.labelled]': 'labelled()', '[attr.title]': 'title()' },
  template: `
    <sw-icon [name]="indicator().icon" [scale]="labelled() ? 2 : 1.5" />
    @if (labelled()) {
      <span class="label">{{ indicator().labelKey | t }}</span>
    }
    <sw-bar [value]="indicator().value" [color]="indicator().color" [count]="labelled() ? 12 : 6"
            [attr.aria-label]="indicator().labelKey | t" />
    <span class="pct">{{ (indicator().value * 100).toFixed(0) }}%</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    :host(.labelled) {
      gap: 8px;
      font: 400 14px/1 var(--sw-font-text);
    }
    .label { flex: 1; }
    .pct { min-width: 30px; text-align: right; font: 400 10px/1 var(--sw-font-ui); }
    :host(.labelled) .pct { min-width: 36px; font-size: 11px; }
  `,
})
export class IndicatorChipComponent {
  readonly indicator = input.required<IndicatorValue>();
  readonly labelled = input(false);

  private readonly translator = inject(Translator);
  /** Los host bindings no admiten pipes: el título se traduce aquí */
  protected readonly title = computed(() => this.translator.t(this.indicator().labelKey));
}
