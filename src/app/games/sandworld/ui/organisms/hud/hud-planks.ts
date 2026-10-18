import { HudPlank } from '../plank-bar/hud-plank.model';
import { SandsPanelComponent } from '../sands-panel/sands-panel';
import { BalancePanelComponent } from '../balance-panel/balance-panel';
import { DecisionsPanelComponent } from '../decisions-panel/decisions-panel';
import { SAND_COLORS } from '../../../config/sands.config';

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
  },
  { id: 'balance', icon: 'scale', labelKey: 'planks.balance', panel: BalancePanelComponent },
  { id: 'decisions', icon: 'letter', labelKey: 'planks.decisions', panel: DecisionsPanelComponent },
];
