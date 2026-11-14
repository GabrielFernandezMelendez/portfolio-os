import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FoodWeb } from '../../../application/balance/balance-tracker';
import { SPECIES_DEFS } from '../../../config/species.config';
import { SEVERITY_COLORS } from '../../../config/balance.config';
import { coinImage } from '../../../rendering/fauna/coin-art';
import { iconRects } from '../../atoms/icon/pixel-icons';
import { TPipe } from '../../../i18n/t.pipe';

const W = 330;
/** Alto de cada fila de la cadena */
const ROW = 78;
const PAD_Y = 26;
/** Moneda: lado mínimo y lo que crece con la población (relativa a la especie más numerosa) */
const COIN_MIN = 16, COIN_GROW = 18;
const RESOURCE = 22;
const RESOURCE_ICON: Record<string, string> = { plants: 'leaf', fish: 'fish', carrion: 'bone' };

/**
 * Pestaña "Cadena" del Equilibrio: quién come a quién. Abajo, la comida que no se mueve (plantas, peces, carroña);
 * cada especie, una fila por encima de lo que come. Moneda más grande = más animales; flecha roja = se cazan más de
 * las que nacen; flecha a rayas = esa comida ya no está en la isla.
 */
@Component({
  selector: 'sw-food-web',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = view();
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + v.h" class="web" role="img" [attr.aria-label]="'balance.tabs.web' | t">
      @for (e of v.edges; track $index) {
        <g [attr.opacity]="e.soft ? 0.5 : 1">
          <line [attr.x1]="e.x1" [attr.y1]="e.y1" [attr.x2]="e.hx" [attr.y2]="e.hy" [attr.stroke]="e.color"
                [attr.stroke-width]="e.width" [attr.stroke-dasharray]="e.dash ? '4 3' : null" />
          <path [attr.d]="e.head" [attr.fill]="e.color" stroke="#2e1a0d" stroke-width="1" />
        </g>
      }
      @for (n of v.nodes; track n.id) {
        @if (n.coin) {
          <image [attr.href]="n.coin" [attr.x]="n.x - n.size / 2" [attr.y]="n.y - n.size / 2" [attr.width]="n.size"
                 [attr.height]="n.size" [attr.opacity]="n.gone ? 0.45 : 1" class="px" />
        } @else {
          <svg [attr.x]="n.x - n.size / 2" [attr.y]="n.y - n.size / 2" [attr.width]="n.size" [attr.height]="n.size"
               [attr.viewBox]="'0 0 ' + n.icon!.w + ' ' + n.icon!.h" shape-rendering="crispEdges">
            @for (r of n.icon!.rects; track $index) {
              <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" height="1" [attr.fill]="r.fill" />
            }
          </svg>
        }
        @if (n.label) {
          <text [attr.x]="n.x" [attr.y]="n.y + n.size / 2 + 11" text-anchor="middle" class="lb">{{ n.label | t }}</text>
        }
      }
    </svg>
    <p class="hint">{{ 'balance.webHint' | t }}</p>
  `,
  styles: `
    :host { display: block; font: 400 14px/1.2 var(--sw-font-text); color: var(--sw-ink); }
    .web { display: block; width: 100%; height: auto; }
    .px { image-rendering: pixelated; }
    .lb { font: 400 10px var(--sw-font-text); fill: var(--sw-ink); }
    .hint { margin: 2px 2px 0; font-size: 12px; opacity: 0.85; }
  `,
})
export class FoodWebComponent {
  readonly web = input.required<FoodWeb>();
  protected readonly w = W;

  protected readonly view = computed(() => {
    const web = this.web();
    const h = PAD_Y * 2 + web.levels * ROW;
    const at = new Map<string, { x: number; y: number; size: number }>();
    const nodes = web.nodes.map(n => {
      const x = 24 + n.x * (W - 48);
      const y = h - PAD_Y - n.level * ROW;
      const size = n.species === null ? RESOURCE : Math.round(COIN_MIN + n.weight * COIN_GROW);
      at.set(n.id, { x, y, size });
      const key = n.species === null ? null : SPECIES_DEFS[n.species].key;
      return {
        id: n.id, x, y, size, gone: n.gone,
        coin: key ? coinImage(key) : null,
        icon: n.resource ? iconRects(RESOURCE_ICON[n.resource]) : null,
        label: n.resource ? `balance.resource.${n.resource}` : null,
      };
    });
    const edges = web.edges.flatMap(e => {
      const a = at.get(e.from), b = at.get(e.to);
      if (!a || !b) return [];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const x1 = a.x + ux * (a.size / 2 + 3), y1 = a.y + uy * (a.size / 2 + 3);
      const ex = b.x - ux * (b.size / 2 + 3), ey = b.y - uy * (b.size / 2 + 3);
      // Lo que come de la isla (plantas, peces, carroña) va fino y claro: así destacan las flechas de caza
      const soft = !e.from.startsWith('s');
      const head = soft ? 6 : 8, half = soft ? 3.5 : 5;
      const hx = ex - ux * head, hy = ey - uy * head;
      const color = e.gone ? SEVERITY_COLORS.none.fill : e.pressure ? SEVERITY_COLORS.bad.fill : SEVERITY_COLORS.good.fill;
      const width = soft ? 1.2 : e.pressure ? 5 : 2 + Math.min(3, e.kills * 0.5);
      return [{
        x1, y1, hx, hy, color, width, soft, dash: e.gone,
        head: `M${ex},${ey} L${hx - uy * half},${hy + ux * half} L${hx + uy * half},${hy - ux * half} z`,
      }];
    });
    return { h, nodes, edges };
  });
}
