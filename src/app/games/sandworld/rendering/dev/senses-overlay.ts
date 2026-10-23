import { Container, Graphics } from 'pixi.js';
import { WORLD } from '../../domain/models/world.model';
import { SPECIES_DEFS } from '../../config/species.config';
import { SUN_HOURS } from '../../config/fauna.config';
import { toGameTime } from '../../domain/models/time.model';
import { FaunaView } from '../fauna/fauna-layer';

/*
  Herramienta de desarrollo (no es para el jugador): hasta dónde ve cada animal (o cada manada, de lejos), con la luz
  del momento (de noche, menos). Sirve para ajustar las distancias de los sentidos y cuántos grupos caben en la isla.
  - De cerca: un anillo por animal (su vista) y, en las presas, el de alerta (amarillo) y el de huida (rojo).
  - De lejos (monedas): un anillo por manada, en su guía.
*/

/** Colores por especie (los mismos que en los gráficos de la simulación) */
const COLORS: Readonly<Record<string, number>> = {
  deer: 0x2a78d6, rabbit: 0xeb6834, wolf: 0x1baf7a, crow: 0xeda100, human: 0xe87ba4, goblin: 0x008300,
};
const ALERT = 0xf6d04c;
const FLEE = 0xe84a2a;
const REFRESH_MS = 250;

/** Punto del mundo de una celda (con la altura del suelo), o null si no está dibujada */
export type CellToWorld = (gx: number, gy: number) => { x: number; y: number } | null;

export class SensesOverlay {
  readonly view = new Container();
  private readonly shapes = new Graphics();
  private elapsed = REFRESH_MS;
  private on = false;

  constructor(private readonly cellWorld: CellToWorld) {
    this.view.zIndex = 9_100;
    this.view.visible = false;
    this.view.addChild(this.shapes);
  }

  show(on: boolean): void {
    this.on = on;
    this.view.visible = on;
    this.elapsed = REFRESH_MS;
    if (!on) this.shapes.clear();
  }

  /** `zoom`: escala de la cámara (el grosor de las líneas se mantiene en pantalla) */
  update(dtMs: number, fauna: FaunaView | undefined, far: boolean, zoom: number): void {
    if (!this.on || !fauna) return;
    this.elapsed += dtMs;
    if (this.elapsed < REFRESH_MS) return;
    this.elapsed = 0;
    const g = this.shapes;
    g.clear();
    const hour = toGameTime(fauna.now).hour % 24;
    const night = hour < SUN_HOURS[0] || hour >= SUN_HOURS[1];
    if (far) {
      for (const h of fauna.herds()) {
        const s = SPECIES_DEFS[h.species];
        this.ring(g, h.x, h.y, s.senses.sight * (night ? s.senses.night : 1), COLORS[s.key] ?? 0xffffff, 4 / zoom, 1, 0.12);
      }
      return;
    }
    for (const a of fauna.animals) {
      if (a.diedAt !== null || a.inside !== null) continue;
      const s = SPECIES_DEFS[a.species];
      this.ring(g, a.x, a.y, s.senses.sight * (night ? s.senses.night : 1), COLORS[s.key] ?? 0xffffff, 3 / zoom, 1, 0.1);
      if (s.senses.wary) {
        this.ring(g, a.x, a.y, s.senses.wary.alert, ALERT, 2 / zoom, 0.8);
        this.ring(g, a.x, a.y, s.senses.wary.flee, FLEE, 2 / zoom, 0.8);
      }
    }
  }

  /**
   * Anillo de `r` celdas alrededor de la celda (x, y), en el suelo: un círculo en el plano de la isla es un rombo
   * redondeado (elipse 2:1) en pantalla. Con `fill`, un relleno suave del mismo color (la vista se ve como una zona,
   * no solo como una raya fina que se pierde sobre la hierba)
   */
  private ring(g: Graphics, x: number, y: number, r: number, color: number, width: number, alpha: number, fill = 0): void {
    const c = this.cellWorld(Math.floor(x), Math.floor(y));
    if (!c) return;
    const G = WORLD.CELLS_PER_TILE;
    // Una celda mide 1/G de tile: en el mundo, (TILE_W/2, TILE_H/2) por tile en cada eje
    const rx = (r / G) * WORLD.TILE_W / Math.SQRT2, ry = (r / G) * WORLD.TILE_H / Math.SQRT2;
    // Contorno oscuro debajo: se ve sobre cualquier suelo (hierba, nieve, agua)
    g.ellipse(c.x, c.y, rx, ry);
    if (fill > 0) g.fill({ color, alpha: fill });
    g.stroke({ color: 0x2e1a0d, width: width * 1.8, alpha: alpha * 0.6 });
    g.ellipse(c.x, c.y, rx, ry).stroke({ color, width, alpha });
  }
}
