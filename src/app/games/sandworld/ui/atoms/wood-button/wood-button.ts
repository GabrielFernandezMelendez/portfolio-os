import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Botón de tabla de madera. Se aplica sobre un <button> nativo (accesible y con teclado gratis):
 *   <button swWood (click)="...">...</button>
 * `active` lo deja hundido (panel abierto, arena elegida...).
 * `variant="plank"`: tabla arcade del estante (esquinas redondeadas por escalones y labio grueso).
 */
@Component({
  selector: 'button[swWood]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[class.active]': 'active()',
    '[class.plank]': 'variant() === "plank"',
    '[attr.aria-pressed]': 'active() ? "true" : null',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      min-width: 40px;
      padding: 0 8px;
      margin: 0;
      border: 6px solid transparent;
      border-image: var(--sw-frame-wood) 3 / 6px / 0 stretch;
      background:
        repeating-linear-gradient(180deg, transparent 0 5px, rgb(110 64 33 / 0.18) 5px 6px),
        var(--sw-wood);
      background-clip: padding-box;
      color: var(--sw-ink-wood);
      font: 400 12px/1 var(--sw-font-ui);
      text-shadow: 1px 1px 0 var(--sw-edge);
      letter-spacing: 0.02em;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      filter: drop-shadow(0 2px 0 rgb(46 26 13 / 0.45));
      transition: transform 60ms steps(1);
    }
    :host(:active), :host(.active) {
      border-image-source: var(--sw-frame-wood-pressed);
      background-color: var(--sw-wood-dk-soft);
      transform: translateY(2px);
      filter: none;
    }
    :host(:focus-visible) {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    /* ── Tabla arcade del estante ── */
    :host(.plank) {
      border-width: 8px;
      border-image: var(--sw-frame-plank) 4 / 8px / 0 stretch;
      background:
        repeating-linear-gradient(180deg, transparent 0 6px, rgb(122 69 36 / 0.35) 6px 7px, transparent 7px 13px, rgb(242 189 120 / 0.25) 13px 14px),
        #b9773f;
      background-clip: padding-box;
      color: #fff6e0;
      font-size: 10px;
      letter-spacing: 0.06em;
      /* Contorno de 1 px alrededor del texto: legible sobre la veta */
      text-shadow: 1px 0 0 var(--sw-edge), -1px 0 0 var(--sw-edge), 0 1px 0 var(--sw-edge), 0 -1px 0 var(--sw-edge), 1px 1px 0 var(--sw-edge);
      filter: none;
    }
    :host(.plank:active), :host(.plank.active) {
      border-image-source: var(--sw-frame-plank-pressed);
      background-color: #a3652f;
      color: var(--sw-accent);
      transform: translateY(2px);
    }
    :host([disabled]) {
      opacity: 0.55;
      cursor: default;
    }
  `,
})
export class WoodButtonComponent {
  readonly active = input(false);
  readonly variant = input<'wood' | 'plank'>('wood');
}
