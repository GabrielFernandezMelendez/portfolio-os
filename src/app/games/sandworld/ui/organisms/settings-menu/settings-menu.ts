import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SANDWORLD_LANGS, SandworldLang } from '../../../domain/models/settings.model';
import { ModalComponent } from '../../molecules/modal/modal';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { TPipe } from '../../../i18n/t.pipe';

/** Ajustes: idioma y salir. El juego queda en pausa mientras está abierto. */
@Component({
  selector: 'sw-settings-menu',
  standalone: true,
  imports: [ModalComponent, WoodButtonComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-modal [heading]="'settings.title' | t" [closeLabel]="'chronicle.close' | t" (close)="close.emit()">
      <h3>{{ 'settings.language' | t }}</h3>
      <div class="langs" role="radiogroup" [attr.aria-label]="'settings.language' | t">
        @for (l of langs; track l) {
          <button swWood role="radio" [active]="lang() === l" [attr.aria-checked]="lang() === l" (click)="langChange.emit(l)">
            {{ 'lang.' + l | t }}
          </button>
        }
      </div>
      <div class="actions">
        <button swWood (click)="close.emit()">{{ 'settings.resume' | t }}</button>
        <button swWood class="exit" (click)="exit.emit()">{{ 'settings.exit' | t }}</button>
      </div>
    </sw-modal>
  `,
  styles: `
    h3 { margin: 0 0 6px; font: 400 12px/1 var(--sw-font-ui); }
    .langs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    .exit { --sw-wood: #9c4a35; }
  `,
})
export class SettingsMenuComponent {
  readonly lang = input.required<SandworldLang>();
  readonly langChange = output<SandworldLang>();
  readonly close = output<void>();
  readonly exit = output<void>();
  protected readonly langs = SANDWORLD_LANGS;
}
