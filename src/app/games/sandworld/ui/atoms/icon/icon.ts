import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { iconRects } from './pixel-icons';

/**
 * Icono pixel. `scale` = píxeles de pantalla por píxel del icono (2 → un icono de 10 px mide 20 px).
 * Decorativo por defecto (aria-hidden): el texto accesible lo pone el botón que lo contiene.
 */
@Component({
  selector: 'sw-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="icon().w * scale()"
      [attr.height]="icon().h * scale()"
      [attr.viewBox]="'0 0 ' + icon().w + ' ' + icon().h"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      @for (r of icon().rects; track $index) {
        <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" height="1" [attr.fill]="r.fill" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; } svg { display: block; }`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly scale = input(2);
  /** Color del contenido (botellas) */
  readonly liquid = input<string | undefined>(undefined);

  protected readonly icon = computed(() => iconRects(this.name(), this.liquid()));
}
