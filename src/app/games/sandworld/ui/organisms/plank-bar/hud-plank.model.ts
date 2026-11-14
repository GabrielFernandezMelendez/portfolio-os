import { Type } from '@angular/core';
import { SandId } from '../../../domain/models/sand.model';
import { BalanceView } from '../../../application/balance/balance-tracker';

/** Estado que algunas tablas usan para su icono (p. ej. la botella toma el color de la arena elegida) */
export interface HudPlankState {
  readonly selectedSand: SandId | null;
  /** Lo que le queda al trazo en curso (1 = lleno) */
  readonly strokeLeft: number;
  /** Cómo van las especies (las barras del botón de Equilibrio) */
  readonly balance: BalanceView | null;
}

/** Barra pequeña dentro de una tabla: altura (0..1) y color */
export interface PlankBar {
  readonly value: number;
  readonly color: string;
}

/**
 * Una tabla del estante inferior y el panel que abre.
 * El panel es un organismo que se conecta solo al servicio (no recibe inputs), así añadir una tabla
 * nueva —árbol de habilidades, mapa, bestiario...— es crear su panel y registrarla en HUD_PLANKS.
 */
export interface HudPlank {
  /** Identificador único; también es el id del panel abierto en el servicio */
  readonly id: string;
  /** Icono pixel (ui/atoms/icon/pixel-icons.ts) */
  readonly icon: string;
  /** Clave de traducción del rótulo */
  readonly labelKey: string;
  /** Panel que se abre sobre el estante */
  readonly panel: Type<unknown>;
  /** Color del líquido del icono, si el icono lo tiene (botellas) */
  readonly liquid?: (state: HudPlankState) => string | undefined;
  /** Medidor bajo el icono (0..1), o null para no mostrarlo (la botella mientras se vierte) */
  readonly meter?: (state: HudPlankState) => number | null;
  /** Columnas en lugar del icono (p. ej. una por especie), o null para enseñar el icono */
  readonly bars?: (state: HudPlankState) => readonly PlankBar[] | null;
  /** Aviso '!' en la esquina (algo va mal) */
  readonly alert?: (state: HudPlankState) => boolean;
}
