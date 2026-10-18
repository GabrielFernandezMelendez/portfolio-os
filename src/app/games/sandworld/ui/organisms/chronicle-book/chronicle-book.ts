import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChronicleEntry } from '../../../domain/models/chronicle.model';
import { ModalComponent } from '../../molecules/modal/modal';
import { TPipe } from '../../../i18n/t.pipe';

/** Libro de la crónica: los últimos 100 mensajes con día y hora. El juego queda en pausa mientras está abierto. */
@Component({
  selector: 'sw-chronicle-book',
  standalone: true,
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-modal [heading]="'chronicle.title' | t" [closeLabel]="'chronicle.close' | t" (close)="close.emit()">
      @if (entries().length) {
        <ol>
          @for (e of entries(); track e.id) {
            <li [attr.data-type]="e.type">
              <span class="when">{{ 'hud.dayShort' | t: { day: e.day } }} · {{ pad(e.hour) }}:{{ pad(e.minute) }}</span>
              <span class="what">
                {{ e.key | t: e.params }}@if (e.count > 1) { <b> {{ 'chronicle.times' | t: { count: e.count } }}</b> }
              </span>
            </li>
          }
        </ol>
      } @else {
        <p class="empty">{{ 'chronicle.empty' | t }}</p>
      }
    </sw-modal>
  `,
  styles: `
    ol { list-style: none; margin: 0; padding: 0; }
    li {
      display: grid;
      grid-template-columns: 74px 1fr;
      gap: 8px;
      padding: 6px 2px;
      border-bottom: 2px dotted var(--sw-parch-dk);
    }
    li:last-child { border-bottom: 0; }
    .when { font: 400 10px/1.6 var(--sw-font-ui); color: var(--sw-wood-dk); }
    li[data-type='catastrophe'] .what { color: #9c2f22; }
    li[data-type='letter'] .what { font-style: italic; }
    .empty { margin: 0; font-style: italic; }
  `,
})
export class ChronicleBookComponent {
  readonly entries = input.required<readonly ChronicleEntry[]>();
  readonly close = output<void>();
  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
