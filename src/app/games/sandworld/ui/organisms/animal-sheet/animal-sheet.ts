import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { AnimalView } from '../../../application/fauna/animal-view';
import { AnimalOrder, DiaryEntry } from '../../../domain/models/animal.model';
import { ParchmentComponent } from '../../atoms/frame/frame';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { IconComponent } from '../../atoms/icon/icon';
import { BarComponent } from '../../atoms/bar/bar';
import { AnimalPortraitComponent } from '../../atoms/animal-portrait/animal-portrait';
import { TPipe } from '../../../i18n/t.pipe';

type Tab = 'status' | 'diary';

/** Barras de la ficha: clave de texto, valor y color (llena = bien) */
const BARS = [
  { key: 'health', color: '#d64a3a' },
  { key: 'rest', color: '#6f84d8' },
  { key: 'satiety', color: '#e08a2e' },
  { key: 'hydration', color: '#3d9ad6' },
  { key: 'happiness', color: '#f2c23d' },
] as const;

/**
 * Ficha de un animal (sale al tocarlo en el mapa). Dos pestañas:
 * - Estado: retrato, nombre, especie y sexo, su manada y qué hace; vida, sueño, hambre, sed y felicidad en barras
 *   con porcentaje; días vivo en la línea de la vida (sin decir cuándo morirá); lo que le afecta; y tres órdenes.
 * - Diario: lo que piensa, con día y hora, con scroll.
 */
@Component({
  selector: 'sw-animal-sheet',
  standalone: true,
  imports: [ParchmentComponent, WoodButtonComponent, IconComponent, BarComponent, AnimalPortraitComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = view();
    <section swParchment class="sheet" role="dialog" [attr.aria-label]="v.name">
      <header>
        <div class="tabs" role="tablist">
          <button swWood role="tab" [active]="tab() === 'status'" [attr.aria-selected]="tab() === 'status'" (click)="tab.set('status')">{{ 'animal.tab.status' | t }}</button>
          <button swWood role="tab" [active]="tab() === 'diary'" [attr.aria-selected]="tab() === 'diary'" (click)="tab.set('diary')">{{ 'animal.tab.diary' | t }}</button>
        </div>
        <button class="x" (click)="close.emit()" [attr.aria-label]="'chronicle.close' | t"><sw-icon name="close" [scale]="1.5" /></button>
      </header>

      @if (tab() === 'status') {
        <div class="who">
          <sw-animal-portrait [kind]="v.young ? 'fawn' : v.sex" [dead]="!v.alive" [size]="64" />
          <div>
            <h3>{{ v.name }}</h3>
            <p class="ui">{{ 'species.' + v.species | t }} · {{ 'animal.sex.' + v.sex | t }}</p>
            <p class="text">{{ herdLine() | t: { name: v.leader ?? '', count: v.herdSize } }} · {{ 'animal.action.' + v.action | t }}</p>
          </div>
        </div>

        <div class="bars">
          @for (b of bars; track b.key) {
            <div class="row">
              <span>{{ 'animal.bar.' + b.key | t }}</span>
              <sw-bar [value]="v[b.key]" [color]="b.color" [count]="10" />
              <b>{{ pct(v[b.key]) }}%</b>
            </div>
          }
        </div>

        <div class="life">
          <div class="line"><span>{{ 'animal.daysAlive' | t }} · {{ 'animal.stage.' + v.stage | t }}</span><span>{{ v.days }}</span></div>
          <div class="track" [style]="trackStyle()">
            <i class="mark" [style.left.%]="v.life * 100"></i>
          </div>
        </div>

        @if (v.factors.length) {
          <div class="factors">
            <span class="ui">{{ 'animal.affects' | t }}</span>
            <div class="chips">
              @for (f of v.factors; track f.key) {
                <span class="chip" [class.bad]="f.value < 0">{{ f.value < 0 ? '−' : '+' }} {{ 'animal.factor.' + f.key | t }}</span>
              }
            </div>
          </div>
        }

        @if (v.alive) {
          <div class="orders">
            <button swWood [active]="v.order === 'eat'" (click)="order.emit('eat')"><sw-icon name="leaf" [scale]="2" />{{ 'animal.order.eat' | t }}</button>
            <button swWood [active]="v.order === 'sleep'" (click)="order.emit('sleep')"><sw-icon name="moon" [scale]="1.5" />{{ 'animal.order.sleep' | t }}</button>
            <button swWood [active]="v.order === 'run'" [disabled]="!v.canRun" (click)="order.emit('run')"><sw-icon name="run" [scale]="2" />{{ 'animal.order.run' | t }}</button>
          </div>
        } @else {
          <p class="dead">{{ 'animal.cause.' + v.cause | t }}</p>
        }
      } @else {
        <div class="who small">
          <sw-animal-portrait [kind]="v.young ? 'fawn' : v.sex" [dead]="!v.alive" [size]="52" />
          <div>
            <h3>{{ v.name }}</h3>
            <p class="ui">{{ 'species.' + v.species | t }} · {{ 'animal.day' | t: { day: v.days } }}</p>
          </div>
        </div>
        <div class="log-wrap">
          <ol class="log" #log (scroll)="measure()">
            @for (e of v.diary; track e.minute + e.key) {
              <li>
                <time>{{ 'hud.dayShort' | t: { day: day(e) } }} · {{ clock(e) }}</time>
                <span>{{ 'animal.diary.' + e.key | t: e.params }}</span>
              </li>
            }
          </ol>
          @if (thumb().height < 100) {
            <div class="scroll" aria-hidden="true"><i [style.top.%]="thumb().top" [style.height.%]="thumb().height"></i></div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; animation: sw-sheet-in 160ms steps(4); }
    .sheet { height: 372px; box-sizing: border-box; padding: 4px 8px 8px; display: flex; flex-direction: column; color: var(--sw-ink); }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { min-height: 32px; font-size: 11px; }
    .x { display: grid; place-items: center; width: 32px; height: 32px; margin: -4px -4px 0 0; border: 0; background: transparent; cursor: pointer; filter: invert(0.15); }
    .who { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
    h3 { margin: 0; font: 600 20px/1 var(--sw-font-text); }
    .small h3 { font-size: 17px; }
    .ui { margin: 4px 0 0; font: 400 10px/1.4 var(--sw-font-ui); }
    .text { margin: 2px 0 0; font: 400 14px/1.2 var(--sw-font-text); opacity: 0.85; }
    .bars { display: flex; flex-direction: column; gap: 5px; container-type: inline-size; }
    .row { display: grid; grid-template-columns: 82px 1fr 38px; align-items: center; gap: 6px; font: 400 11px/1 var(--sw-font-ui); }
    .row sw-bar { --seg-w: calc((100cqw - 126px - 13px) / 10); --seg-h: 8px; }
    .row b { font-weight: 400; text-align: right; }
    .life { margin-top: 7px; padding-top: 5px; border-top: 2px dotted var(--sw-parch-dk); }
    .line { display: flex; justify-content: space-between; font: 400 11px/1 var(--sw-font-ui); }
    .track {
      position: relative; height: 8px; margin: 6px 0 2px; border: 2px solid var(--sw-edge);
      background: linear-gradient(90deg, #b9d98a 0 var(--j), #8fc25a var(--j) var(--a), #d9b45a var(--a) var(--e), #b08a6a var(--e));
    }
    .mark { position: absolute; top: -5px; width: 4px; height: 14px; margin-left: -2px; background: var(--sw-edge); }
    .factors { margin-top: 6px; padding-top: 5px; border-top: 2px dotted var(--sw-parch-dk); }
    .chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
    .chip { padding: 3px 4px; border: 2px solid #4f8a2e; background: #d6ecb0; font: 400 12px/1 var(--sw-font-text); }
    .chip.bad { border-color: #b0472f; background: #f3c9b4; }
    .orders { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: auto; padding-top: 8px; }
    .orders button { min-height: 36px; padding: 0 4px; font-size: 10px; }
    .dead { margin: auto 0 0; font: 400 15px/1.3 var(--sw-font-text); font-style: italic; text-align: center; }
    .log-wrap { position: relative; flex: 1; min-height: 0; }
    .log { list-style: none; margin: 0; padding: 0 16px 0 0; height: 100%; overflow-y: auto; scrollbar-width: none; overscroll-behavior: contain; }
    .log::-webkit-scrollbar { display: none; }
    .log li { display: grid; grid-template-columns: 66px 1fr; gap: 8px; padding: 6px 0; border-bottom: 2px dotted var(--sw-parch-dk); font: 400 14px/1.25 var(--sw-font-text); }
    .log time { font: 400 9px/1.7 var(--sw-font-ui); color: var(--sw-wood-dk); }
    /* Barra de scroll de madera (la del sistema no se ve en el móvil) */
    .scroll { position: absolute; top: 0; right: 0; bottom: 0; width: 10px; box-sizing: border-box; background: var(--sw-parch-dk); border: 2px solid var(--sw-edge); }
    .scroll i { position: absolute; left: 0; right: 0; background: var(--sw-wood); box-shadow: inset 2px 0 0 var(--sw-wood-hi); border-block: 2px solid var(--sw-edge); box-sizing: border-box; }
    @keyframes sw-sheet-in { from { transform: translateY(12px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class AnimalSheetComponent {
  readonly view = input.required<AnimalView>();
  readonly close = output<void>();
  readonly order = output<AnimalOrder>();

  protected readonly bars = BARS;
  protected readonly tab = signal<Tab>('status');
  private readonly scroll = signal({ top: 0, height: 1, client: 1 });

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // Al abrir el diario o llegar una entrada nueva, se mide la lista para la barra de scroll
    effect(() => {
      this.view();
      if (this.tab() === 'diary') requestAnimationFrame(() => this.measure());
    });
  }

  /** Colores de la línea de la vida: cría, joven, adulto y viejo */
  protected readonly trackStyle = computed(() => {
    const [j, a, e] = this.view().marks.map(m => `${(m * 100).toFixed(1)}%`);
    return `--j: ${j}; --a: ${a}; --e: ${e}`;
  });

  /** Texto de su manada: guía, miembro o solo */
  protected readonly herdLine = computed(() => {
    const v = this.view();
    if (!v.alive) return 'animal.herd.none';
    if (v.herdSize <= 1) return 'animal.herd.alone';
    return v.leader ? 'animal.herd.member' : 'animal.herd.leader';
  });

  /** Posición y tamaño (%) del pulgar de la barra de scroll del diario */
  protected readonly thumb = computed(() => {
    const s = this.scroll();
    const height = Math.min(100, (s.client / Math.max(1, s.height)) * 100);
    return { top: Math.min(100 - height, (s.top / Math.max(1, s.height)) * 100), height };
  });

  protected measure(): void {
    const el = this.log()?.nativeElement;
    if (el) this.scroll.set({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight });
  }

  protected pct(v: number): number {
    return Math.round(Math.max(0, Math.min(1, v)) * 100);
  }

  protected day(e: DiaryEntry): number {
    return Math.floor(e.minute / 1440) + 1;
  }

  protected clock(e: DiaryEntry): string {
    const m = e.minute % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
}
