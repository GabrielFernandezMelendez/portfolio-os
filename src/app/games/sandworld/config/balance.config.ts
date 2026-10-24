/*
  Panel de Equilibrio [PROPUESTA]: cuándo se dice que una especie prospera, pasa hambre o está al borde.
  Son umbrales para enseñárselo al jugador con palabras; no cambian la simulación.
*/

/** Días que guarda el gráfico (uno por amanecer) */
export const BALANCE_DAYS = 30;

/** Días hacia atrás con los que se mira la tendencia (▲ ▼) y las causas (quién muere y de qué) */
export const BALANCE_RECENT_DAYS = 3;

/** Días con los que se compara lo que se caza de una presa con lo que nace (flecha roja en la cadena) */
export const BALANCE_PRESSURE_DAYS = 7;

/** Variación (en proporción) para que la tendencia cuente como subida o bajada */
export const BALANCE_TREND = 0.15;

/** Al borde: quedan estos animales o menos (o menos que su manada mínima) */
export const BALANCE_EDGE_POP = 2;

/** Al borde: el hambre media de la especie baja de aquí */
export const BALANCE_EDGE_SATIETY = 0.2;

/** Pasan hambre: el hambre media baja de aquí, o alguno ha muerto de hambre en los últimos días */
export const BALANCE_HUNGRY_SATIETY = 0.35;

/** Demasiados: población por encima de lo que la isla puede alimentar (× capacidad) */
export const BALANCE_CROWDED = 1.2;

/** Prosperan: crecen y siguen por debajo de lo que la isla puede alimentar (× capacidad) */
export const BALANCE_ROOM = 0.9;

/** Les aprietan: las muertes por caza de los últimos días, frente a la población (proporción) */
export const BALANCE_PRESSED = 0.15;

/** Cadena alimentaria: se dibuja la flecha de una presa si pesa al menos esto en lo que caza el depredador */
export const BALANCE_WEB_PREY = 0.3;

/** Cadena alimentaria: carroñeros (comen carroña al menos con este peso): se les une al nodo de la carroña */
export const BALANCE_WEB_CARRION = 0.9;

/** Barras del botón: cuántas especies caben (las más numerosas) */
export const BALANCE_BUTTON_BARS = 8;

/** Color de cada especie en el gráfico y en las barras (por clave; una especie nueva añade el suyo) */
export const SPECIES_COLORS: Readonly<Record<string, string>> = {
  deer: '#2a78d6', rabbit: '#eb6834', wolf: '#1baf7a', crow: '#eda100', human: '#e87ba4', goblin: '#008300',
};

/** Colores por gravedad: el de la barra o el punto y el del texto (más oscuro, legible sobre el pergamino) */
export const SEVERITY_COLORS: Readonly<Record<'good' | 'warn' | 'bad' | 'none', { readonly fill: string; readonly text: string }>> = {
  good: { fill: '#4caf50', text: '#2e7d32' },
  warn: { fill: '#e0a020', text: '#9a6200' },
  bad: { fill: '#d8442c', text: '#b0301c' },
  none: { fill: '#9a8a70', text: '#7a6a50' },
};
