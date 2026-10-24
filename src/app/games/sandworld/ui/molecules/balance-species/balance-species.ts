import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpeciesBalance } from '../../../application/balance/balance-tracker';
import { SEVERITY_COLORS, SPECIES_COLORS } from '../../../config/balance.config';
import { SPECIES_DEFS } from '../../../config/species.config';
import { CoinComponent } from '../../atoms/coin/coin';
import { TPipe } from '../../../i18n/t.pipe';

/** Barra de 12 segmentos (como la de los indicadores) */
const SEGMENTS = Array.from({ length: 12 }, (_, i) => i);

/**
 * Pestaña "Especies" del Equilibrio: una fila por especie que ha pisado la isla. Cómo está (en palabras y con su
 * porqué), hacia dónde va (▲ ▼ =) y una barra con la raya de lo que la isla puede alimentar. Sin números internos.
 */
@Component({
  selector: 'sw-balance-species',
  standalone: true,
  imports: [CoinComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (s of rows(); track s.species) {
      <div class="row">
        <sw-coin [species]="s.key" [size]="22" [class.gone]="s.population === 0" />
        <span class="nm">{{ 'balance.group.' + s.key | t }}</span>
        <span class="ar" [style.color]="sev[s.severity].fill"
              [attr.title]="'balance.trend.' + (s.trend > 0 ? 'up' : s.trend < 0 ? 'down' : 'flat') | t">
          {{ s.population === 0 ? '×' : s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '=' }}
        </span>
        <span class="st" [style.color]="sev[s.severity].text">
          {{ 'balance.mood.' + s.mood | t: (s.by !== null ? { predator: '@balance.group.' + key(s.by) } : undefined) }}
          @if (s.population === 0 && returns(s.species)) { {{ 'balance.back' | t }} }
        </span>
        <span class="bar" aria-hidden="true">
          @for (i of segments; track i) {
            <i [class.on]="i < s.fill * 12" [style.background]="i < s.fill * 12 ? color(s.key) : null"></i>
          }
          @if (s.cap !== null) {
            <b class="cap" [style.left.px]="2 + s.cap * 12 * 5 - 1"></b>
          }
        </span>
      </div>
    }
    <p class="hint">{{ 'balance.capHint' | t }}</p>
  `,
  styles: `
    :host { display: block; font: 400 14px/1.2 var(--sw-font-text); color: var(--sw-ink); }
    .row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 2px dotted rgb(74 44 23 / 0.18); }
    .row:last-of-type { border-bottom: 0; }
    .nm { width: 70px; flex: none; }
    .nm::first-letter { text-transform: uppercase; }
    .ar { width: 14px; flex: none; text-align: center; font: 400 12px/1 var(--sw-font-ui); }
    .st { flex: 1; font-size: 12px; }
    .bar { position: relative; flex: none; display: inline-flex; gap: 1px; padding: 2px; background: var(--sw-edge); }
    .bar i { width: 4px; height: 8px; background: var(--sw-parch-dk); }
    .bar i.on { box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.35), inset 0 -2px 0 rgb(0 0 0 / 0.2); }
    .cap { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--sw-ink); }
    .hint { margin: 6px 2px 0; font-size: 12px; opacity: 0.8; }
  `,
})
export class BalanceSpeciesComponent {
  readonly rows = input.required<readonly SpeciesBalance[]>();
  protected readonly segments = SEGMENTS;
  protected readonly sev = SEVERITY_COLORS;

  protected key(species: number): string {
    return SPECIES_DEFS[species].key;
  }

  protected color(key: string): string {
    return SPECIES_COLORS[key] ?? '#888';
  }

  /** Puede volver por la orilla (tiene llegadas) */
  protected returns(species: number): boolean {
    return !!SPECIES_DEFS[species].migration;
  }
}
