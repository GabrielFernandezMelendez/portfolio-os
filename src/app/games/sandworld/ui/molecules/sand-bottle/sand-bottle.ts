import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SandId } from '../../../domain/models/sand.model';
import { SAND_COLORS } from '../../../config/sands.config';
import { IconComponent } from '../../atoms/icon/icon';
import { TPipe } from '../../../i18n/t.pipe';

/** Botella de arena seleccionable */
@Component({
  selector: 'sw-sand-bottle',
  standalone: true,
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="bottle" [class.selected]="selected()" (click)="pick.emit(sand())"
            [attr.aria-pressed]="selected()" [attr.title]="'sands.' + sand() + '.desc' | t">
      <span class="glass"><sw-icon name="bottle" [scale]="3" [liquid]="color()" /></span>
      <span class="name">{{ 'sands.' + sand() + '.name' | t }}</span>
    </button>
  `,
  styles: `
    .bottle {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      width: 100%;
      padding: 4px 0 3px;
      border: 2px solid transparent;
      background: transparent;
      color: var(--sw-ink);
      font: 400 11px/1 var(--sw-font-text);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .glass {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      background: rgb(110 64 33 / 0.12);
      box-shadow: inset 2px 2px 0 rgb(110 64 33 / 0.2);
    }
    .bottle.selected .glass {
      background: var(--sw-accent);
      box-shadow: inset 0 0 0 2px var(--sw-edge), inset 2px 2px 0 4px #ffe08a;
      animation: sw-bob 0.9s steps(2) infinite;
    }
    .bottle.selected .name { font-weight: 600; }
    .bottle:focus-visible { outline: 2px solid var(--sw-accent); }
    @keyframes sw-bob { 50% { transform: translateY(-2px); } }
    @media (prefers-reduced-motion: reduce) { .bottle.selected .glass { animation: none; } }
  `,
})
export class SandBottleComponent {
  readonly sand = input.required<SandId>();
  readonly selected = input(false);
  readonly pick = output<SandId>();

  protected color(): string {
    return SAND_COLORS[this.sand()];
  }
}
