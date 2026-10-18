import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SandworldService } from '../../../sandworld.service';
import { SheetComponent } from '../../molecules/sheet/sheet';
import { IconComponent } from '../../atoms/icon/icon';
import { TPipe } from '../../../i18n/t.pipe';

/** Panel de Decisiones: aquí llegarán las cartas del Dios Espagueti Flotante (fase 5) */
@Component({
  selector: 'sw-decisions-panel',
  standalone: true,
  imports: [SheetComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-sheet [heading]="'decisions.title' | t" [closeLabel]="'chronicle.close' | t" (close)="game.closePanel()">
      <div class="empty">
        <sw-icon name="letter" [scale]="4" />
        <p>{{ 'decisions.empty' | t }}</p>
      </div>
    </sw-sheet>
  `,
  styles: `
    .empty { display: flex; align-items: center; gap: 12px; padding: 4px 2px 6px; }
    .empty sw-icon { opacity: 0.6; }
    p { margin: 0; font-size: 13px; }
  `,
})
export class DecisionsPanelComponent {
  protected readonly game = inject(SandworldService);
}
