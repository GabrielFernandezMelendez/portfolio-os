import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Marco de madera (placa de hora, chips de indicadores). Uso: <div swWoodFrame>...</div> */
@Component({
  selector: '[swWoodFrame]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      border: 6px solid transparent;
      border-image: var(--sw-frame-wood) 3 / 6px / 0 stretch;
      background:
        repeating-linear-gradient(180deg, transparent 0 5px, rgb(110 64 33 / 0.18) 5px 6px),
        var(--sw-wood);
      background-clip: padding-box;
      color: var(--sw-ink-wood);
      text-shadow: 1px 1px 0 var(--sw-edge);
      filter: drop-shadow(0 2px 0 rgb(46 26 13 / 0.45));
    }
  `,
})
export class WoodFrameComponent {}

/** Panel de pergamino con marco (paneles, menús, crónica). Uso: <section swParchment>...</section> */
@Component({
  selector: '[swParchment]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      border: 6px solid transparent;
      border-image: var(--sw-frame-parchment) 3 / 6px / 0 stretch;
      background:
        radial-gradient(circle at 20% 15%, rgb(255 255 255 / 0.25), transparent 40%),
        radial-gradient(circle at 85% 90%, rgb(183 130 70 / 0.18), transparent 45%),
        var(--sw-parch);
      background-clip: padding-box;
      color: var(--sw-ink);
      font: 400 14px/1.35 var(--sw-font-text);
      filter: drop-shadow(0 3px 0 rgb(46 26 13 / 0.45));
    }
  `,
})
export class ParchmentComponent {}
