import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BalanceHistory } from '../../../application/balance/balance-tracker';
import { SPECIES_COLORS } from '../../../config/balance.config';
import { SPECIES_DEFS } from '../../../config/species.config';
import { CoinComponent } from '../../atoms/coin/coin';
import { TPipe } from '../../../i18n/t.pipe';

/** Medidas del gráfico (en unidades del viewBox; el SVG ocupa el ancho del panel) */
const W = 330, H = 170;
const PAD = { l: 22, r: 8, t: 10, b: 20 };
/** Marcas con texto: solo las últimas (las demás, solo el círculo), para que no se pisen */
const LABELLED_MARKS = 3;

/**
 * Pestaña "Gráfico" del Equilibrio: cuántos hay de cada especie, un punto por amanecer (los últimos 30 días; el último
 * es ahora mismo), con círculos donde la crónica contó algo (llegadas, el último de una especie, marchas, brotes).
 */
@Component({
  selector: 'sw-balance-chart',
  standalone: true,
  imports: [CoinComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = chart();
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="plot" role="img" [attr.aria-label]="'balance.tabs.chart' | t">
      @for (g of c.grid; track g.v) {
        <line [attr.x1]="pad.l" [attr.x2]="w - pad.r" [attr.y1]="g.y" [attr.y2]="g.y" class="grid" />
        <text [attr.x]="pad.l - 4" [attr.y]="g.y + 3" text-anchor="end" class="ax">{{ g.v }}</text>
      }
      @for (t of c.ticks; track t.x) {
        <text [attr.x]="t.x" [attr.y]="h - 6" text-anchor="middle" class="ax">{{ 'balance.day' | t: { day: t.day } }}</text>
      }
      @for (s of c.lines; track s.species) {
        @if (s.count > 1) {
          <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="2.5" stroke-linejoin="round" />
        } @else {
          <circle [attr.cx]="s.x0" [attr.cy]="s.y0" r="3" [attr.fill]="s.color" />
        }
      }
      @for (m of c.marks; track $index) {
        <circle [attr.cx]="m.x" [attr.cy]="m.y" r="4" fill="#fff7e2" [attr.stroke]="m.color" stroke-width="2">
          <title>{{ 'balance.group.' + m.key | t }} · {{ 'balance.mark.' + m.kind | t }}</title>
        </circle>
        @if (m.label) {
          <text [attr.x]="m.x + (m.left ? -6 : 6)" [attr.y]="m.y - 5" [attr.text-anchor]="m.left ? 'end' : 'start'"
                class="mk" [attr.fill]="m.color">{{ 'balance.mark.' + m.kind | t }}</text>
        }
      }
    </svg>
    <div class="legend">
      @for (s of c.lines; track s.species) {
        <span><sw-coin [species]="s.key" [size]="16" /><span class="nm" [style.border-color]="s.color">{{ 'balance.group.' + s.key | t }}</span></span>
      }
    </div>
    <p class="hint">{{ 'balance.chartHint' | t }}</p>
  `,
  styles: `
    :host { display: block; font: 400 14px/1.2 var(--sw-font-text); color: var(--sw-ink); }
    .plot { display: block; width: 100%; height: auto; background: rgb(255 255 255 / 0.25); border: 2px solid var(--sw-edge); }
    .grid { stroke: rgb(74 44 23 / 0.18); }
    .ax { font: 400 8px var(--sw-font-ui); fill: var(--sw-ink); }
    .mk { font: 400 9px var(--sw-font-text); paint-order: stroke; stroke: #fff7e2; stroke-width: 2px; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 6px; font-size: 12px; }
    .legend > span { display: inline-flex; align-items: center; gap: 3px; }
    .nm { border-bottom: 3px solid; }
    .nm::first-letter { text-transform: uppercase; }
    .hint { margin: 4px 2px 0; font-size: 12px; opacity: 0.8; }
  `,
})
export class BalanceChartComponent {
  readonly history = input.required<BalanceHistory>();
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;

  protected readonly chart = computed(() => {
    const hist = this.history();
    const n = hist.days.length;
    const top = Math.max(1, ...hist.series.flatMap(s => s.values));
    const step = top > 20 ? 10 : 5;
    const max = Math.ceil(top / step) * step;
    const X = (i: number) => (n <= 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r));
    const Y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
    const grid = [];
    for (let v = 0; v <= max; v += step) grid.push({ v, y: Y(v) });
    // Días del eje: el primero, el último y un par en medio
    const idx = n <= 1 ? [0] : [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])];
    const ticks = idx.map(i => ({ x: X(i), day: hist.days[i] }));
    const lines = hist.series.map(s => {
      const key = SPECIES_DEFS[s.species].key;
      return {
        species: s.species, key, color: SPECIES_COLORS[key] ?? '#888',
        points: s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' '),
        count: s.values.length,
        x0: X(0), y0: Y(s.values[0] ?? 0),
      };
    });
    const marks = hist.marks.map((m, k) => {
      const i = Math.max(0, hist.days.indexOf(m.day));
      const key = SPECIES_DEFS[m.species].key;
      const v = hist.series.find(s => s.species === m.species)?.values[i] ?? 0;
      const x = X(i);
      return { x, y: Y(v), key, kind: m.kind, color: SPECIES_COLORS[key] ?? '#888', label: k >= hist.marks.length - LABELLED_MARKS, left: x > W * 0.65 };
    });
    return { grid, ticks, lines, marks };
  });
}
