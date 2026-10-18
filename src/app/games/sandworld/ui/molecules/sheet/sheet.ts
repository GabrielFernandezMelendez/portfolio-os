import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../atoms/icon/icon';
import { ParchmentComponent } from '../../atoms/frame/frame';

/** Hoja de pergamino que sube desde la barra de tablas (paneles de Arenas, Equilibrio y Decisiones) */
@Component({
  selector: 'sw-sheet',
  standalone: true,
  imports: [IconComponent, ParchmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section swParchment class="sheet" role="dialog" [attr.aria-label]="heading()">
      <header>
        <h2>{{ heading() }}</h2>
        <button class="x" (click)="close.emit()" [attr.aria-label]="closeLabel()">
          <sw-icon name="close" [scale]="1.5" />
        </button>
      </header>
      <ng-content />
    </section>
  `,
  styles: `
    :host { display: block; animation: sw-sheet-in 160ms steps(4); }
    .sheet { padding: 4px 8px 8px; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    h2 { margin: 0; font: 400 14px/1 var(--sw-font-ui); color: var(--sw-ink); }
    .x {
      display: grid; place-items: center;
      width: 32px; height: 32px; margin: -4px -4px 0 0;
      border: 0; background: transparent; cursor: pointer;
      filter: invert(0.15);
    }
    @keyframes sw-sheet-in { from { transform: translateY(12px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class SheetComponent {
  readonly heading = input.required<string>();
  readonly closeLabel = input('Cerrar');
  readonly close = output<void>();
}
