import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { ChronicleEntry } from '../../../domain/models/chronicle.model';
import { CHRONICLE_ROTATE_MS, CHRONICLE_STRIP_COUNT } from '../../../config/chronicle.config';
import { WoodFrameComponent } from '../../atoms/frame/frame';
import { TPipe } from '../../../i18n/t.pipe';

/**
 * Tablón de anuncios (crónica): rota los últimos mensajes; uno nuevo se muestra al momento.
 * Al tocarlo se abre el libro.
 */
@Component({
  selector: 'sw-chronicle-strip',
  standalone: true,
  imports: [WoodFrameComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button swWoodFrame class="board" (click)="open.emit()" [attr.aria-label]="'chronicle.open' | t">
      <span class="note">
        <i class="pin" aria-hidden="true"></i>
        @if (current(); as e) {
          @let n = e.count;
          <span class="msg" [attr.data-id]="e.id">
            {{ e.key | t: e.params }}@if (n > 1) { <b> {{ 'chronicle.times' | t: { count: n } }}</b> }
          </span>
        } @else {
          <span class="msg empty">{{ 'chronicle.empty' | t }}</span>
        }
        <span class="dots" aria-hidden="true">
          @for (e of recent(); track e.id; let i = $index) {
            <i [class.on]="i === index()"></i>
          }
        </span>
      </span>
    </button>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    /* Tablón: marco de madera con una nota de pergamino clavada */
    .board {
      width: 100%;
      height: 100%;
      padding: 0;
      cursor: pointer;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
    }
    .note {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
      /* 2 px de madera alrededor: la nota nunca tapa el marco */
      height: calc(100% - 4px);
      margin: 2px;
      padding: 2px 4px 1px 6px;
      background: var(--sw-parch);
      box-shadow: inset -2px -2px 0 var(--sw-parch-dk), 1px 1px 0 var(--sw-edge);
      color: var(--sw-ink);
      text-shadow: none;
      font: 400 11px/1.2 var(--sw-font-text);
    }
    .pin {
      position: absolute;
      top: -4px;
      left: 50%;
      width: 4px;
      height: 4px;
      margin-left: -2px;
      background: #c8483a;
      box-shadow: 0 0 0 1px var(--sw-edge), 1px 1px 0 1px rgb(0 0 0 / 0.25);
    }
    .msg {
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      animation: sw-msg-in 280ms steps(4);
    }
    .msg.empty { opacity: 0.7; font-style: italic; }
    .dots { display: flex; flex-direction: column; gap: 2px; }
    .dots i { width: 3px; height: 3px; background: var(--sw-parch-dk); }
    .dots i.on { background: var(--sw-ink); }
    @keyframes sw-msg-in {
      from { opacity: 0; transform: translateY(3px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .msg { animation: none; }
    }
  `,
})
export class ChronicleStripComponent {
  readonly entries = input.required<readonly ChronicleEntry[]>();
  readonly open = output<void>();

  protected readonly recent = computed(() => this.entries().slice(0, CHRONICLE_STRIP_COUNT));
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.recent()[this.index()] ?? null);

  constructor() {
    // Mensaje nuevo → se muestra él primero y la rotación vuelve a empezar
    let lastTop = -1;
    effect(() => {
      const top = this.entries()[0]?.id ?? -1;
      if (top !== lastTop) {
        lastTop = top;
        this.index.set(0);
      }
    });

    const timer = setInterval(() => {
      const n = this.recent().length;
      if (n > 1) this.index.update(i => (i + 1) % n);
    }, CHRONICLE_ROTATE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
