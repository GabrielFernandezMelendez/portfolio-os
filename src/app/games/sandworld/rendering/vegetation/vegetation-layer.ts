import { Container, Sprite } from 'pixi.js';
import { ChunkData, cellIndex } from '../../domain/models/chunk.model';
import { GameTime } from '../../domain/models/time.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { PlantInstance, RevealedFn, layoutOf } from '../../application/vegetation/plant-layout';
import { plantLook } from './plant-look';
import { plantSize, plantTexture } from './plant-sprites';
import { BRUSH_CELLS } from '../../config/brush.config';

/** Nieve (en niveles) en la celda a partir de la que la planta se ve nevada: de nevada o de Escarcha */
const SNOWY_SEASONAL = 0.03;
const SNOWY = 0.15;

interface PlacedPlant {
  readonly inst: PlantInstance;
  readonly sprite: Sprite;
  /** Clave del sprite: la de la planta, o 'sprout' si es un cultivo recién sembrado */
  readonly key: string;
  look: string;
}

/** Aspecto fijo de los sprites que no cambian con la estación (tierra labrada) */
const STATIC_LOOK = { autumn: 0, leaves: 1, dry: 0, snow: false } as const;

/**
 * Plantas de un chunk como sprites encima de su terreno horneado (dentro del contenedor del chunk).
 * Se recolocan cuando cambia la vegetación o el terreno; su aspecto de estación se actualiza cada poco.
 */
export class VegetationLayer {
  readonly view = new Container();
  private placed: PlacedPlant[] = [];
  private tilled: Sprite[] = [];

  constructor() {
    this.view.sortableChildren = true;
  }

  /**
   * Coloca las plantas del chunk. `cellTop` da el punto (local al contenedor del chunk) de la cara superior
   * de una celda: ahí va el pie de la planta.
   */
  layout(chunk: ChunkData, cellTop: (ci: number, cj: number) => { x: number; y: number }, time: GameTime, revealed: RevealedFn): void {
    for (const p of this.placed) p.sprite.destroy();
    this.placed = [];
    for (const t of this.tilled) t.destroy();
    this.tilled = [];
    for (const inst of layoutOf(chunk, revealed)) {
      const def = PLANT_DEFS[inst.plant];
      const key = inst.sprout ? 'sprout' : def.key;
      const size = plantSize(key);
      // Los cultivos ocupan una casilla del cursor: se dibujan en su centro
      const top = inst.crop ? cellTop(inst.ci + (BRUSH_CELLS - 1) / 2, inst.cj + (BRUSH_CELLS - 1) / 2) : cellTop(inst.ci, inst.cj);
      // Los cultivos llevan debajo un poco de tierra labrada
      if (inst.crop) {
        const soil = new Sprite(plantTexture('tilled', STATIC_LOOK));
        const s = plantSize('tilled');
        soil.position.set(Math.round(top.x - Math.floor(s.w / 2)), Math.round(top.y - 1));
        soil.zIndex = top.y - 0.5;
        this.view.addChild(soil);
        this.tilled.push(soil);
      }
      const sprite = new Sprite();
      sprite.position.set(Math.round(top.x - Math.floor(size.w / 2)), Math.round(top.y - size.h + 1));
      sprite.zIndex = top.y;
      this.view.addChild(sprite);
      this.placed.push({ inst, sprite, key, look: '' });
    }
    this.updateSeason(chunk, time);
  }

  /** Cambia la textura de las plantas cuyo aspecto de estación (o su nieve) ha cambiado */
  updateSeason(chunk: ChunkData, time: GameTime): void {
    for (const p of this.placed) {
      const def = PLANT_DEFS[p.inst.plant];
      const k = cellIndex(p.inst.ci, p.inst.cj);
      const snow = chunk.cover[k] > (chunk.coverSeasonal[k] ? SNOWY_SEASONAL : SNOWY);
      const look = plantLook(def, p.inst.seed, time, snow);
      const id = `${look.autumn}|${look.leaves}|${look.dry}|${look.snow}`;
      if (id === p.look) continue;
      p.look = id;
      p.sprite.texture = plantTexture(p.key, look);
    }
  }

  /** Planta bajo un punto (local al contenedor del chunk), la de delante si hay varias */
  plantAt(x: number, y: number): PlantInstance | null {
    let best: PlacedPlant | null = null;
    for (const p of this.placed) {
      const s = p.sprite;
      if (x < s.x || y < s.y || x >= s.x + s.texture.width || y >= s.y + s.texture.height - 1) continue;
      if (!best || s.zIndex > best.sprite.zIndex) best = p;
    }
    return best?.inst ?? null;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
