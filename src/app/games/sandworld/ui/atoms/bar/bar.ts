import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de progreso pixel por segmentos (indicadores). `value` de 0 a 1. */
@Component({
  selector: 'sw-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'meter',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
  },
  template: `
    @for (on of segments(); track $index) {
      <span [class.on]="on" [style.--c]="color()"></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 1px;
      padding: 2px;
      background: var(--sw-edge);
    }
    span {
      width: var(--seg-w, 5px);
      height: var(--seg-h, 8px);
      background: var(--sw-parch-dk);
      box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.12);
    }
    span.on {
      background: var(--c);
      box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.35), inset 0 -2px 0 rgb(0 0 0 / 0.2);
    }
  `,
})
export class BarComponent {
  readonly value = input(0);
  readonly color = input('#5fae3e');
  readonly count = input(8);

  protected readonly percent = computed(() => Math.round(this.value() * 100));
  protected readonly segments = computed(() => {
    const filled = Math.round(Math.min(1, Math.max(0, this.value())) * this.count());
    return Array.from({ length: this.count() }, (_, i) => i < filled);
  });
}
