import { WORLD } from '../domain/models/world.model';

/*
  Proyección isométrica del mundo.
  Coordenadas de tile globales (u, v): el centro del tile (i, j) está en (i, j).
  Coordenadas de mundo (x, y): píxeles del contenedor `world` a escala 1; el centro del tile (0,0) a nivel 0 es (0, 0).
  Cada nivel de altura sube la imagen LEVEL_PX píxeles.
*/

export interface Point {
  x: number;
  y: number;
}

/** De tile (con altura en niveles) a mundo */
export function isoToWorld(u: number, v: number, level = 0): Point {
  return {
    x: (u - v) * WORLD.TILE_W / 2,
    y: (u + v) * WORLD.TILE_H / 2 - level * WORLD.LEVEL_PX,
  };
}

/** De mundo a tile, suponiendo que el punto está a la altura `level` */
export function worldToIso(x: number, y: number, level = 0): Point {
  const a = (2 * x) / WORLD.TILE_W;                        // u - v
  const b = (2 * (y + level * WORLD.LEVEL_PX)) / WORLD.TILE_H; // u + v
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Centro de la celda física (ci, cj) de un chunk, en coordenadas de tile globales */
export function cellCenter(cx: number, cy: number, ci: number, cj: number): Point {
  const G = WORLD.CELLS_PER_TILE;
  return {
    x: cx * WORLD.TILES + (ci + 0.5) / G - 0.5,
    y: cy * WORLD.TILES + (cj + 0.5) / G - 0.5,
  };
}
