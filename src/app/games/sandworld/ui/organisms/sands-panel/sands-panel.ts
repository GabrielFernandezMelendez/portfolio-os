import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SAND_ORDER } from '../../../domain/models/sand.model';
import { SandworldService } from '../../../sandworld.service';
import { SheetComponent } from '../../molecules/sheet/sheet';
import { SandBottleComponent } from '../../molecules/sand-bottle/sand-bottle';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { TPipe } from '../../../i18n/t.pipe';

/** Panel de Arenas: las 8 botellas. Elegir una activa el pincel; repetir la suelta. */
@Component({
  selector: 'sw-sands-panel',
  standalone: true,
  imports: [SheetComponent, SandBottleComponent, WoodButtonComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-sheet [heading]="'sands.title' | t" [closeLabel]="'chronicle.close' | t" (close)="game.closePanel()">
      <div class="grid">
        @for (s of sands; track s) {
          <sw-sand-bottle [sand]="s" [selected]="game.selectedSand() === s" (pick)="game.selectSand($event)" />
        }
      </div>
      <p class="hint">
        @if (game.selectedSand(); as s) {
          <b>{{ 'sands.' + s + '.name' | t }}:</b> {{ 'sands.' + s + '.desc' | t }}
          <br /><i>{{ 'sands.soon' | t }}</i>
        } @else {
          {{ 'sands.hint' | t }}
        }
      </p>
      @if (game.selectedSand(); as s) {
        <button swWood class="drop" (click)="game.selectSand(s)">{{ 'sands.drop' | t }}</button>
      }
    </sw-sheet>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 4px; }
    .hint { margin: 6px 2px 0; font-size: 13px; min-height: 2.6em; }
    .drop { width: 100%; margin-top: 6px; }
  `,
})
export class SandsPanelComponent {
  protected readonly game = inject(SandworldService);
  protected readonly sands = SAND_ORDER;
}
