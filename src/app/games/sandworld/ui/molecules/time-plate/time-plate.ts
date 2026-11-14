import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GameTime } from '../../../domain/models/time.model';
import { PrecipitationLook } from '../../../domain/models/weather.model';
import { lightLevel } from '../../../application/time/daylight';
import { IconComponent } from '../../atoms/icon/icon';
import { WoodFrameComponent } from '../../atoms/frame/frame';
import { TPipe } from '../../../i18n/t.pipe';

/** Placa de madera compacta: sol o luna (o lluvia, nieve) + hora arriba, día · estación debajo */
@Component({
  selector: 'sw-time-plate',
  standalone: true,
  imports: [IconComponent, WoodFrameComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div swWoodFrame class="plate">
      <div class="row">
        <sw-icon [name]="icon()" [scale]="2" [attr.title]="weather() !== 'none' ? ('weather.' + weather() | t) : null" />
        <span class="clock">{{ clock() }}</span>
      </div>
      <span class="date">{{ 'hud.dayShort' | t: { day: time().dayOfSeason } }} · {{ 'season.' + time().season | t }}</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .plate {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 2px;
      height: 100%;
      padding: 0 4px 1px 2px;
    }
    .row { display: flex; align-items: center; gap: 4px; }
    .clock { font: 400 16px/1 var(--sw-font-ui); }
    .date {
      font: 400 9px/1 var(--sw-font-ui);
      color: var(--sw-parch);
      white-space: nowrap;
    }
  `,
})
export class TimePlateComponent {
  readonly time = input.required<GameTime>();
  /** Lo que cae del cielo ahora: si llueve o nieva, su icono sustituye al sol o la luna */
  readonly weather = input<PrecipitationLook>('none');

  protected readonly isDay = computed(() => lightLevel(this.time().minuteOfDay) >= 0.5);
  protected readonly icon = computed(() => (this.weather() !== 'none' ? this.weather() : this.isDay() ? 'sun' : 'moon'));
  protected readonly clock = computed(() => {
    const t = this.time();
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  });
}
