import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Rect } from '../camera';
import { WORLD } from '../../domain/models/world.model';
import { isoToWorld } from '../iso';
import {
  CLOUD_TILE_H, CLOUD_TILE_W, PUFF_H, PUFF_W, bakeCloudPuff, bakeCloudSea, bakeCloudWisps, bakeIslandShadow,
} from './cloud-baker';
import { CLOUD_SHADOW } from '../../config/palette.config';
import {
  CLOUD_SEA_MARGIN, CLOUD_SEA_SPEED, CLOUD_WISP_ALPHA, CLOUD_WISP_SPEED,
} from '../../config/clouds.config';

const PUFF_VARIANTS = 4;

function textureFrom(width: number, height: number, paint: (out: Uint8ClampedArray) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  paint(img.data);
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/**
 * Nubes alrededor de la isla (adaptador de Pixi).
 * - `back`: mar de nubes, copos altos y sombras de los chunks, detrás de todo el terreno.
 * La isla flota por encima: sus paredes de tierra quedan a la vista (opción A).
 * Van dentro del contenedor del mundo: se mueven con la cámara y se tiñen con el día y la noche.
 */
export class CloudLayer {
  readonly back = new Container();

  private readonly seaTex: Texture;
  private readonly wispTex: Texture;
  private readonly puffTex: Texture[];
  private readonly sea: TilingSprite;
  private readonly wisps: TilingSprite;
  private readonly shadows = new Container();
  private shadowTex: Texture | null = null;
  private time = 0;

  constructor(seed: number) {
    this.seaTex = textureFrom(CLOUD_TILE_W, CLOUD_TILE_H, out => bakeCloudSea(seed, out));
    this.wispTex = textureFrom(CLOUD_TILE_W, CLOUD_TILE_H, out => bakeCloudWisps(seed, out));
    this.puffTex = Array.from({ length: PUFF_VARIANTS }, (_, i) =>
      textureFrom(PUFF_W, PUFF_H, out => bakeCloudPuff(seed + i * 17, PUFF_W, PUFF_H, out)));

    this.sea = new TilingSprite({ texture: this.seaTex, width: 1, height: 1 });
    this.wisps = new TilingSprite({ texture: this.wispTex, width: 1, height: 1 });
    this.wisps.alpha = CLOUD_WISP_ALPHA;
    this.back.addChild(this.sea, this.wisps, this.shadows);
    this.back.zIndex = -10_000;
  }

  /** Extiende el mar alrededor del rectángulo del mundo descubierto */
  cover(bounds: Rect): void {
    for (const t of [this.sea, this.wisps]) {
      t.position.set(bounds.x - CLOUD_SEA_MARGIN, bounds.y - CLOUD_SEA_MARGIN);
      t.width = bounds.w + CLOUD_SEA_MARGIN * 2;
      t.height = bounds.h + CLOUD_SEA_MARGIN * 2;
    }
  }

  /** Texturas de copos (las usa también la aparición de chunks) */
  get puffTextures(): readonly Texture[] {
    return this.puffTex;
  }

  /** Sombra de un chunk descubierto sobre el mar de nubes: más abajo que la isla, como si flotara */
  castShadow(cx: number, cy: number): Sprite {
    const N = WORLD.TILES;
    const w = N * WORLD.TILE_W, h = N * WORLD.TILE_H;
    this.shadowTex ??= textureFrom(w, h, out => bakeIslandShadow(w, h, CLOUD_SHADOW, out));
    const center = isoToWorld(cx * N + N / 2 - 0.5, cy * N + N / 2 - 0.5);
    const sprite = new Sprite(this.shadowTex);
    sprite.anchor.set(0.5);
    // Desplazada abajo y a la derecha: luz que llega desde arriba a la izquierda
    sprite.position.set(Math.round(center.x + 14), Math.round(center.y + 34));
    this.shadows.addChild(sprite);
    return sprite;
  }

  /** Viento y vaivén. dt en ms reales: las nubes se mueven aunque el juego esté en pausa. */
  update(dtMs: number): void {
    this.time += dtMs;
    const s = dtMs / 1000;
    this.sea.tilePosition.x += CLOUD_SEA_SPEED * s;
    this.wisps.tilePosition.x += CLOUD_WISP_SPEED * s;
    this.wisps.tilePosition.y = Math.round(Math.sin(this.time / 2600) * 2);
    // Posiciones enteras: el pixel art no tiembla
    // Posiciones a cuartos de píxel: el pixel art no tiembla
    this.sea.tilePosition.x = Math.round(this.sea.tilePosition.x * 4) / 4;
  }

  destroy(): void {
    this.back.destroy({ children: true });
    for (const t of [this.seaTex, this.wispTex, ...this.puffTex]) t.destroy(true);
    this.shadowTex?.destroy(true);
  }
}
