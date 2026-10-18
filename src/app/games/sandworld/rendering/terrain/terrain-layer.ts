import { Container, Sprite, Texture } from 'pixi.js';
import { ChunkData } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { BAKE_HEIGHT, BAKE_ORIGIN_X, BAKE_ORIGIN_Y, BAKE_WIDTH, ChunkBaker } from './chunk-baker';
import { Rect } from '../camera';

/** Celda seleccionada: chunk + índice local + altura visible */
export interface PickedCell {
  cx: number;
  cy: number;
  ci: number;
  cj: number;
  surface: number;
}

/**
 * Adaptador de Pixi para el terreno de un chunk.
 * El ChunkBaker pinta en un buffer RGBA; esta clase lo vuelca a un canvas y lo sube como textura.
 * Re-hornear (cuando cambie el terreno en la fase 2) solo actualiza la textura existente.
 */
export class TerrainLayer {
  readonly view = new Container();

  private readonly baker: ChunkBaker;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly texture: Texture;
  private readonly sprite: Sprite;
  private chunk: ChunkData | null = null;

  constructor(seed: number) {
    this.baker = new ChunkBaker(seed);

    this.canvas = document.createElement('canvas');
    this.canvas.width = BAKE_WIDTH;
    this.canvas.height = BAKE_HEIGHT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Sandworld: canvas 2D no disponible');
    this.ctx = ctx;
    this.image = ctx.createImageData(BAKE_WIDTH, BAKE_HEIGHT);

    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';     // pixel art: sin interpolación al escalar

    this.sprite = new Sprite(this.texture);
    this.view.addChild(this.sprite);
  }

  /** Hornea el chunk y lo coloca en su posición isométrica dentro del mundo */
  render(chunk: ChunkData): void {
    this.chunk = chunk;
    this.baker.bake(chunk, this.image.data);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();

    // El píxel BAKE_ORIGIN corresponde al centro del tile (0,0) del chunk
    const ox = chunk.cx * WORLD.TILES;
    const oy = chunk.cy * WORLD.TILES;
    this.sprite.position.set(
      (ox - oy) * WORLD.TILE_W / 2 - BAKE_ORIGIN_X,
      (ox + oy) * WORLD.TILE_H / 2 - BAKE_ORIGIN_Y,
    );
  }

  /** Rectángulo que ocupa el chunk en coordenadas de mundo (para los límites de la cámara) */
  get bounds(): Rect {
    return { x: this.sprite.x, y: this.sprite.y, w: BAKE_WIDTH, h: BAKE_HEIGHT };
  }

  /** Celda visible en un punto del mundo, o null si ahí no hay terreno */
  pick(wx: number, wy: number): PickedCell | null {
    if (!this.chunk) return null;
    const k = this.baker.pickCell(wx - this.sprite.x, wy - this.sprite.y);
    if (k < 0) return null;
    const ci = k % WORLD.CELLS;
    const cj = Math.floor(k / WORLD.CELLS);
    return { cx: this.chunk.cx, cy: this.chunk.cy, ci, cj, surface: this.baker.surfaceAtCell(ci, cj) };
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.texture.destroy(true);
  }
}
