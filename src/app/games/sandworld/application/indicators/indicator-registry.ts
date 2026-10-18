/**
 * Indicadores del HUD (agua, vegetación; más adelante fauna, riqueza, ejército...).
 * Añadir uno nuevo = registrar una definición; el HUD los pinta todos sin cambios.
 */
export interface IndicatorDef {
  readonly id: string;
  /** Nombre del icono pixel (ui/atoms/icon) */
  readonly icon: string;
  /** Clave de traducción de su nombre */
  readonly labelKey: string;
  /** Color de la barra (CSS) */
  readonly color: string;
  /** Valor actual, 0..1 */
  read(): number;
}

export interface IndicatorValue {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: string;
  readonly color: string;
  readonly value: number;
}

export class IndicatorRegistry {
  private readonly defs: IndicatorDef[] = [];

  register(def: IndicatorDef): void {
    if (this.defs.some(d => d.id === def.id)) throw new Error(`Indicador duplicado: ${def.id}`);
    this.defs.push(def);
  }

  /** Lee todos los indicadores (en orden de registro), con el valor limitado a 0..1 */
  snapshot(): IndicatorValue[] {
    return this.defs.map(d => {
      const v = d.read();
      return {
        id: d.id,
        icon: d.icon,
        labelKey: d.labelKey,
        color: d.color,
        value: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0,
      };
    });
  }
}
