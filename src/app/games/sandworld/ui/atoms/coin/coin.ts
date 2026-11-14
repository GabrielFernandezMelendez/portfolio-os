import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { coinImage } from '../../../rendering/fauna/coin-art';

/** Moneda de una especie (la misma de la vista de lejos), en pixel art nítido. `size`: lado en px de pantalla */
@Component({
  selector: 'sw-coin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="url()" [attr.width]="size()" [attr.height]="size()" alt="" />`,
  styles: `
    :host { display: inline-flex; line-height: 0; flex: none; }
    img { image-rendering: pixelated; display: block; }
    :host(.gone) img { filter: grayscale(1); opacity: 0.55; }
  `,
})
export class CoinComponent {
  /** Clave de la especie (registro) */
  readonly species = input.required<string>();
  readonly size = input(22);
  protected readonly url = computed(() => coinImage(this.species()));
}
