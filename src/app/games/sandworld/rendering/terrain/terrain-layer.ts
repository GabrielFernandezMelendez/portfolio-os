import { Container, Sprite, Texture } from 'pixi.js';
import { ChunkData } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { BAKE_HEIGHT, BAKE_ORIGIN_X, BAKE_ORIGIN_Y, BAKE_WIDTH, ChunkBaker } from './chunk-baker';
import { Rect } from '../camera';
import { VegetationLayer } from '../vegetation/vegetation-layer';
import { FireLayer } from '../fire/fire-layer';
import { GameTime } from '../../domain/models/time.model';
import { PlantInstance, RevealedFn, invalidateLayout } from '../../application/vegetation/plant-layout';

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
  /** Plantas del chunk, encima del terreno */
  private readonly plants = new VegetationLayer();
  /** Fuego, humo y brasas, mezclados con las plantas (se ordenan juntos por profundidad) */
  private readonly fire = new FireLayer(this.plants.view);

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
    this.view.addChild(this.sprite, this.plants.view);
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

  /** Chunk que dibuja esta capa (null antes del primer horneado) */
  get coords(): { cx: number; cy: number } | null {
    return this.chunk ? { cx: this.chunk.cx, cy: this.chunk.cy } : null;
  }

  /**
   * Vuelve a colocar las plantas. `terrainChanged`: el agua o las alturas han cambiado y hay que volver a mirar
   * dónde caben (no solo cuántas hay).
   */
  layoutPlants(time: GameTime, revealed: RevealedFn, terrainChanged = false): void {
    if (!this.chunk) return;
    if (terrainChanged) invalidateLayout(this.chunk);
    this.plants.layout(this.chunk, (ci, cj) => this.cellTop(ci, cj), time, revealed);
    if (terrainChanged) this.fire.layout(this.chunk, (ci, cj) => this.cellTop(ci, cj));
  }

  /** Actualiza el aspecto de estación de las plantas (otoño, caída de hojas, nieve) */
  updatePlants(time: GameTime): void {
    if (this.chunk) this.plants.updateSeason(this.chunk, time);
  }

  /** Animaciones de las plantas (nacer, caer, hundirse…), en tiempo real */
  animatePlants(dtMs: number): void {
    this.plants.update(dtMs);
    if (this.chunk) this.fire.update(dtMs, this.chunk, (ci, cj) => this.cellTop(ci, cj));
  }

  /** Punto del mundo de la cara superior de una celda del chunk (para el rayo y para llevar la cámara) */
  cellPoint(ci: number, cj: number): { x: number; y: number } {
    return this.cellTop(ci, cj);
  }

  /** Planta dibujada bajo un punto del mundo, o null */
  plantAt(wx: number, wy: number): PlantInstance | null {
    return this.plants.plantAt(wx, wy);
  }

  /** Punto (en coordenadas del mundo, que son las del contenedor) de la cara superior de una celda */
  private cellTop(ci: number, cj: number): { x: number; y: number } {
    const G = WORLD.CELLS_PER_TILE;
    const u = (ci + 0.5) / G - 0.5, v = (cj + 0.5) / G - 0.5;
    return {
      x: this.sprite.x + BAKE_ORIGIN_X + (u - v) * WORLD.TILE_W / 2,
      y: this.sprite.y + BAKE_ORIGIN_Y + (u + v) * WORLD.TILE_H / 2 - this.baker.surfaceAtCell(ci, cj) * WORLD.LEVEL_PX,
    };
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
    this.fire.destroy();
    this.plants.destroy();
    this.view.destroy({ children: true });
    this.texture.destroy(true);
  }
}
