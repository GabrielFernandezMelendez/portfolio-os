import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Etiqueta de pergamino con una flechita hacia abajo: el bioma del tile que se ha tocado */
@Component({
  selector: 'sw-tile-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tag" role="status">{{ label() }}</span>`,
  styles: `
    :host { display: block; animation: sw-tag 2.5s steps(1) forwards; }
    .tag {
      position: relative;
      display: block;
      padding: 3px 8px 4px;
      background: var(--sw-parch, #f7dfa8);
      color: var(--sw-ink, #4a2c17);
      font: 400 12px/1 var(--sw-font-ui);
      white-space: nowrap;
      box-shadow: 0 0 0 2px var(--sw-edge, #2e1a0d), 2px 2px 0 2px rgb(46 26 13 / 0.35);
    }
    /* Flechita pixel hacia el tile */
    .tag::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -6px;
      width: 6px;
      height: 4px;
      margin-left: -3px;
      background: var(--sw-parch, #f7dfa8);
      box-shadow: 0 2px 0 0 var(--sw-edge, #2e1a0d), -2px 0 0 0 var(--sw-edge, #2e1a0d), 2px 0 0 0 var(--sw-edge, #2e1a0d);
    }
    @keyframes sw-tag {
      0% { opacity: 0; transform: translateY(3px); }
      5% { opacity: 1; transform: none; }
      85% { opacity: 1; }
      92% { opacity: 0.5; }
      100% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class TileTagComponent {
  readonly label = input.required<string>();
}
