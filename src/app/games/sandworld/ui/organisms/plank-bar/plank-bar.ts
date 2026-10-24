import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HudPlank } from './hud-plank.model';
import { SandId } from '../../../domain/models/sand.model';
import { BalanceView } from '../../../application/balance/balance-tracker';
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
      <button swWood variant="plank" class="plank" [active]="panel() === p.id" (click)="toggle.emit(p.id)">
        @let bars = p.bars?.(state()) ?? null;
        @if (bars) {
          <span class="bars" aria-hidden="true">
            @for (b of bars; track $index) {
              <i [style.height.px]="b.value ? 2 + b.value * 13 : 2" [style.background]="b.value ? b.color : null"></i>
            }
          </span>
        } @else {
          <sw-icon [name]="p.icon" [scale]="2" [liquid]="p.liquid?.(state())" />
        }
        @if (p.alert?.(state())) {
          <b class="alert" aria-hidden="true">!</b>
        }
        @let m = p.meter?.(state()) ?? null;
        @if (m !== null) {
          <i class="meter" [style.--fill]="m"></i>
        }
        <span>{{ p.labelKey | t }}</span>
      </button>
    }
  `,
  styles: `
    /* Estante de madera de lado a lado, pegado al borde inferior (no flota) */
    :host {
      position: relative;
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
    /* Clavos del estante en las dos esquinas superiores */
    :host::before, :host::after {
      content: '';
      position: absolute;
      top: 3px;
      width: 2px;
      height: 2px;
      background: #c9c2b0;
      box-shadow: 1px 1px 0 #4f2a15;
    }
    :host::before { left: 2px; }
    :host::after { right: 3px; }
    .plank {
      position: relative;
      flex-direction: column;
      gap: 3px;
      min-height: 62px;
      padding: 0 2px 2px;
    }
    /* Medidor pixel bajo el icono: lo que le queda al trazo */
    .meter {
      display: block;
      width: 28px;
      height: 4px;
      background: linear-gradient(90deg, var(--sw-accent) calc(var(--fill) * 100%), rgb(46 26 13 / 0.45) 0);
      box-shadow: 0 0 0 1px var(--sw-edge);
    }
    /* Columnas en lugar del icono (Equilibrio: una por especie) */
    .bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 20px;
      padding: 2px 3px;
      background: var(--sw-edge);
    }
    .bars i { display: block; width: 5px; background: #5a4a3a; box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.35); }
    /* Aviso: una especie está al borde */
    .alert {
      position: absolute;
      top: -6px;
      right: -2px;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      background: #d8442c;
      color: #fff;
      font: 400 11px/1 var(--sw-font-ui);
      text-shadow: none;
      border: 2px solid var(--sw-edge);
      animation: sw-alert 1s steps(2) infinite;
    }
    @keyframes sw-alert { 50% { transform: translateY(-2px); } }
    @media (prefers-reduced-motion: reduce) { .alert { animation: none; } }
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
  readonly strokeLeft = input(1);
  readonly balance = input<BalanceView | null>(null);
  readonly toggle = output<string>();

  protected readonly state = computed(() => ({ selectedSand: this.selectedSand(), strokeLeft: this.strokeLeft(), balance: this.balance() }));
}
