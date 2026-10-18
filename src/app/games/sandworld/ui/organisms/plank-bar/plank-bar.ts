import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HudPlank } from './hud-plank.model';
import { SandId } from '../../../domain/models/sand.model';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { IconComponent } from '../../atoms/icon/icon';
import { TPipe } from '../../../i18n/t.pipe';

/** Estante inferior: una tabla por cada entrada registrada, repartidas a partes iguales */
@Component({
  selector: 'sw-plank-bar',
  standalone: true,
  imports: [WoodButtonComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--planks]': 'planks().length' },
  template: `
    @for (p of planks(); track p.id) {
      <button swWood class="plank" [active]="panel() === p.id" (click)="toggle.emit(p.id)">
        <sw-icon [name]="p.icon" [scale]="2" [liquid]="p.liquid?.(state())" />
        <span>{{ p.labelKey | t }}</span>
      </button>
    }
  `,
  styles: `
    /* Estante de madera de lado a lado, pegado al borde inferior (no flota) */
    :host {
      display: grid;
      grid-template-columns: repeat(var(--planks, 3), minmax(0, 1fr));
      gap: 4px;
      padding: 6px 6px max(6px, env(safe-area-inset-bottom));
      background:
        repeating-linear-gradient(180deg, transparent 0 5px, rgb(46 26 13 / 0.22) 5px 6px),
        var(--sw-wood-dk);
      border-top: 2px solid var(--sw-edge);
      box-shadow: inset 0 2px 0 var(--sw-wood-dk-soft), 0 -2px 0 rgb(46 26 13 / 0.25);
    }
    .plank {
      flex-direction: column;
      gap: 4px;
      min-height: 58px;
      padding: 2px;
      font-size: 10px;
    }
    .plank span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class PlankBarComponent {
  readonly planks = input.required<readonly HudPlank[]>();
  readonly panel = input<string | null>(null);
  readonly selectedSand = input<SandId | null>(null);
  readonly toggle = output<string>();

  protected readonly state = computed(() => ({ selectedSand: this.selectedSand() }));
}
