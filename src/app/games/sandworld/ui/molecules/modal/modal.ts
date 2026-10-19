import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../atoms/icon/icon';
import { ParchmentComponent } from '../../atoms/frame/frame';

/** Ventana modal de pergamino sobre un velo oscuro (Ajustes, Crónica). Tocar el velo la cierra. */
@Component({
  selector: 'sw-modal',
  standalone: true,
  imports: [IconComponent, ParchmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'close.emit()' },
  template: `
    <div class="veil" (click)="close.emit()"></div>
    <section swParchment class="box" role="dialog" aria-modal="true" [attr.aria-label]="heading()">
      <header>
        <h2>{{ heading() }}</h2>
        <button class="x" (click)="close.emit()" [attr.aria-label]="closeLabel()">
          <sw-icon name="close" [scale]="2" />
        </button>
      </header>
      <div class="body"><ng-content /></div>
    </section>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 30;
      /* Flex y no grid: en una fila de grid automática el max-height: 100% de la caja no limita nada
         y el contenido largo se cortaba sin scroll. Con flex, la caja no pasa de la altura de la pantalla. */
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .veil {
      position: absolute;
      inset: 0;
      background: rgb(28 35 66 / 0.55);
      animation: sw-fade 160ms steps(3);
    }
    .box {
      position: relative;
      width: min(100%, 360px);
      max-height: 100%;
      min-height: 0;
      /* El borde de pergamino y el relleno cuentan dentro del 100%: si no, la caja se salía del margen */
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 6px 10px 10px;
      animation: sw-pop 180ms steps(4);
    }
    header { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    h2 { margin: 0; font: 400 16px/1 var(--sw-font-ui); }
    .x { display: grid; place-items: center; width: 36px; height: 36px; margin-right: -6px; border: 0; background: transparent; cursor: pointer; }
    /* Solo el cuerpo se desplaza (la cabecera con la X queda fija); con el dedo, en vertical */
    .body { overflow-y: auto; min-height: 0; touch-action: pan-y; overscroll-behavior: contain; }
    @keyframes sw-fade { from { opacity: 0; } }
    @keyframes sw-pop { from { transform: scale(0.94); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .veil, .box { animation: none; } }
  `,
})
export class ModalComponent {
  readonly heading = input.required<string>();
  readonly closeLabel = input('Cerrar');
  readonly close = output<void>();
}
