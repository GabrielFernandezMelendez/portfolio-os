import { HudPlank } from '../plank-bar/hud-plank.model';
import { SandsPanelComponent } from '../sands-panel/sands-panel';
import { BalancePanelComponent } from '../balance-panel/balance-panel';
import { DecisionsPanelComponent } from '../decisions-panel/decisions-panel';
import { SAND_COLORS } from '../../../config/sands.config';
import { BALANCE_BUTTON_BARS, SEVERITY_COLORS } from '../../../config/balance.config';

/**
 * Tablas del estante inferior, en orden de izquierda a derecha.
 * Para añadir una (p. ej. árbol de habilidades):
 *   1. crea su panel en ui/organisms/<nombre>-panel (inyecta SandworldService y usa <sw-sheet>)
 *   2. añade su icono en pixel-icons.ts y sus textos en i18n/es.json y en.json
 *   3. regístrala aquí
 */
export const HUD_PLANKS: readonly HudPlank[] = [
  {
    id: 'sands',
    icon: 'bottle',
    labelKey: 'planks.sands',
    panel: SandsPanelComponent,
    liquid: s => (s.selectedSand ? SAND_COLORS[s.selectedSand] : '#d8b375'),
    // Mientras se vierte, cuánto le queda al trazo
    meter: s => (s.selectedSand && s.strokeLeft < 1 ? s.strokeLeft : null),
  },
  {
    id: 'balance',
    icon: 'scale',
    labelKey: 'planks.balance',
    panel: BalancePanelComponent,
    // Una columna por especie (las más numerosas): alto = cuántos hay frente a lo que la isla puede alimentar,
    // color = cómo están. Sin animales, la balanza
    bars: s => {
      const list = s.balance?.species ?? [];
      if (!list.length) return null;
      return [...list]
        .sort((a, b) => b.population - a.population)
        .slice(0, BALANCE_BUTTON_BARS)
        .sort((a, b) => a.species - b.species)
        .map(b => ({ value: b.population ? Math.max(0.12, Math.min(1, b.cap ? b.fill / b.cap : b.fill)) : 0, color: SEVERITY_COLORS[b.severity].fill }));
    },
    alert: s => !!s.balance?.alert,
  },
  { id: 'decisions', icon: 'letter', labelKey: 'planks.decisions', panel: DecisionsPanelComponent },
];
