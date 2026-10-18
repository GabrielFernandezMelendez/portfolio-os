import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WoodFrameComponent } from '../../atoms/frame/frame';
import { TPipe } from '../../../i18n/t.pipe';

/** Cartel "Isla viva · Nivel N" que aparece unos segundos al empezar y al tocar la isla */
@Component({
  selector: 'sw-island-label',
  standalone: true,
  imports: [WoodFrameComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div swWoodFrame class="sign" role="status">{{ 'hud.island' | t: { level: level() } }}</div>`,
  styles: `
    :host { animation: sw-sign 3s steps(1) forwards; }
    .sign { max-width: 100%; }
    .sign { padding: 2px 10px; font: 400 13px/1.4 var(--sw-font-ui); white-space: nowrap; }
    /* Entra de golpe, se queda y se desvanece por pasos (estilo pixel) */
    @keyframes sw-sign {
      0% { opacity: 0; transform: translateY(-4px); }
      4% { opacity: 1; transform: none; }
      85% { opacity: 1; }
      90% { opacity: 0.66; }
      95% { opacity: 0.33; }
      100% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class IslandLabelComponent {
  readonly level = input(1);
}
