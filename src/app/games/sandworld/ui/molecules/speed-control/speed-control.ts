import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SimSpeed } from '../../../domain/models/settings.model';
import { IconComponent } from '../../atoms/icon/icon';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { TPipe } from '../../../i18n/t.pipe';

/**
 * Velocidad (x1 → x2 → x4) y pausa. Con una arena cogida (y el menú de arenas cerrado), delante, la X para soltarla:
 * así se puede mover el mapa con un dedo sin abrir y cerrar el menú
 */
@Component({
  selector: 'sw-speed-control',
  standalone: true,
  imports: [IconComponent, WoodButtonComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sand()) {
      <button swWood class="drop" (click)="drop.emit()" [attr.aria-label]="'hud.dropSand' | t">
        <sw-icon name="close" [scale]="2" />
      </button>
    }
    <button swWood class="speed" (click)="cycle.emit()">
      {{ 'hud.speed' | t: { speed: speed() } }}
    </button>
    <button swWood [active]="paused()" (click)="togglePause.emit()" [attr.aria-label]="(paused() ? 'hud.play' : 'hud.pause') | t">
      <sw-icon [name]="paused() ? 'play' : 'pause'" [scale]="2" />
    </button>
  `,
  styles: `
    :host { display: flex; gap: 4px; }
    .speed { min-width: 48px; font-size: 13px; }
    /* Soltar la arena: la misma tabla, teñida de rojo para que se distinga */
    .drop { min-width: 48px; background-color: #b8452a; background-blend-mode: multiply; }
  `,
})
export class SpeedControlComponent {
  readonly speed = input.required<SimSpeed>();
  readonly paused = input.required<boolean>();
  readonly cycle = output<void>();
  readonly togglePause = output<void>();
  /** ¿Hay una arena cogida? (sale la X para soltarla) */
  readonly sand = input(false);
  readonly drop = output<void>();
}
