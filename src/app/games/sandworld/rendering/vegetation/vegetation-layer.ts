import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { ChunkData, cellIndex } from '../../domain/models/chunk.model';
import { GameTime, SeasonId } from '../../domain/models/time.model';
import { PlantDef } from '../../domain/models/plant.model';
import { PLANT_DEFS } from '../../config/plants.config';
import { PLANT_ART } from '../../config/plant-art.config';
import { FRUIT_REGROW_DAYS, FRUIT_RIPEN_DAYS, PLANT_ANIM_MS, REMAINS_DAYS } from '../../config/plant-life.config';
import { BRUSH_CELLS } from '../../config/brush.config';
import { WORLD } from '../../domain/models/world.model';
import {
  DeathCause, PlantDeath, PlantInstance, PlantRemains, RevealedFn, Stage, drowning, dueForRecheck, layoutOf, plantDevFlags, remainsOf, stageOf,
  takeBirths, takeDeaths,
} from '../../application/vegetation/plant-layout';
import { plantStress } from '../../application/vegetation/vegetation';
import { ArtLook, FRESH } from './plant-art';
import { plantLook } from './plant-look';
import { fallTexture, lookStep, plantSize, plantTexture, shadowTexture } from './plant-sprites';
import { frontOrder } from '../../application/fire/fire';
import { FLAME_FRAMES, flameTexture } from '../fire/fire-sprites';

/** Nieve (en niveles) en la celda a partir de la que la planta se ve nevada: de nevada o de Escarcha */
const SNOWY_SEASONAL = 0.03;
const SNOWY = 0.15;
const G = WORLD.CELLS_PER_TILE;
const SPARKLE = 0xf8f2a0;
const BUBBLE = 0xe8f6ff;
const SAND_GRAIN = 0xe8c87a;

type CellTop = (ci: number, cj: number) => { x: number; y: number };

interface PlacedPlant {
  readonly inst: PlantInstance;
  readonly sprite: Sprite;
  readonly shadow: Sprite;
  /** Punto del pie en el contenedor del chunk */
  readonly foot: { x: number; y: number };
  artKey: string;
  young: boolean;
  look: string;
  lastLook: ArtLook;
  stage: Stage;
  /** ms que le quedan a un saltito (nace o cambia de etapa) */
  bounce: number;
  /** Llamas encima mientras arde (el frente del fuego del suelo ha llegado a su celda) */
  flame: { sprite: Sprite; w: number; h: number; frame: number } | null;
}

/** Cada cuánto se mira qué plantas arden y cada cuánto parpadean sus llamas (ms reales) */
const FIRE_SCAN_MS = 250;
const FLICKER_MS = 110;

/** Una animación en curso (muerte, nacimiento o partículas). update devuelve true al terminar. */
interface Anim {
  update(dtMs: number): boolean;
  destroy(): void;
}

/**
 * Plantas de un chunk como sprites encima de su terreno horneado (dentro del contenedor del chunk).
 * Cada planta tiene su sombra proyectada, crece por etapas (semilla, brote, joven, adulta), muestra su fruto en
 * temporada y cuando no se lo han comido, se apaga si sufre y, al morir, se anima según la causa: el árbol cae,
 * lo inundado se hunde, lo que tapa la arena se entierra y lo que se seca se marchita y se deshace. Quedan restos
 * unos días (tocón, tronco, mata seca). Las plantas no se recolocan nunca: solo nacen y mueren.
 */
export class VegetationLayer {
  readonly view = new Container();
  private placed = new Map<PlantInstance, PlacedPlant>();
  private tilled: Sprite[] = [];
  private remains = new Map<PlantRemains, Sprite>();
  /** Restos cuya planta aún se está animando (se muestran al terminar) */
  private readonly waiting = new Set<PlantInstance>();
  private readonly anims: Anim[] = [];
  private chunk: ChunkData | null = null;
  private fireScan = 0;
  private flicker = 0;
  private cellTop: CellTop | null = null;
  private revealed: RevealedFn | null = null;

  constructor() {
    this.view.sortableChildren = true;
  }

  /**
   * Revisa las plantas del chunk: crea las nuevas, quita las muertas (animándolas) y deja las demás donde están.
   * `cellTop` da el punto (local al contenedor del chunk) de la cara superior de una celda: ahí va el pie.
   */
  layout(chunk: ChunkData, cellTop: CellTop, time: GameTime, revealed: RevealedFn): void {
    this.chunk = chunk;
    this.cellTop = cellTop;
    this.revealed = revealed;
    const list = layoutOf(chunk, revealed, time.totalMinutes);
    const births = new Set(takeBirths(chunk));
    const deaths = takeDeaths(chunk);

    // Las que siguen: se recoloca su pie (el suelo puede haber subido o bajado) sin cambiar de celda
    const keep = new Set(list);
    for (const [inst, p] of this.placed) {
      if (keep.has(inst)) continue;
      const death = deaths.find(d => d.inst === inst);
      if (death) this.animateDeath(p, death);
      else this.removePlaced(p);
      this.placed.delete(inst);
    }
    for (const t of this.tilled) t.destroy();
    this.tilled = [];
    for (const inst of list) {
      const foot = this.footOf(inst);
      let p = this.placed.get(inst);
      if (!p) {
        p = this.createPlaced(inst, foot);
        this.placed.set(inst, p);
        if (births.has(inst)) this.animateBirth(p);
      } else if (p.foot.x !== foot.x || p.foot.y !== foot.y) {
        p.foot.x = foot.x;
        p.foot.y = foot.y;
        if (p.artKey) this.place(p);
      }
      if (inst.crop) this.addTilled(foot);
    }
    this.layoutRemains(time);
    this.updateSeason(chunk, time, true);
  }

  /** Cambia la textura de las plantas cuyo aspecto (estación, etapa, fruto, sufrimiento, nieve) ha cambiado */
  updateSeason(chunk: ChunkData, time: GameTime, force = false): void {
    // Una planta con agua que ya lleva demasiado tiempo: se revisa aunque el terreno no haya cambiado
    if (!force && this.cellTop && this.revealed && dueForRecheck(chunk, time.totalMinutes)) {
      this.layout(chunk, this.cellTop, time, this.revealed);
      return;
    }
    const stress = new Map<number, number>();
    for (const p of this.placed.values()) {
      const def = PLANT_DEFS[p.inst.plant];
      const k = cellIndex(p.inst.ci, p.inst.cj);
      const snow = chunk.cover[k] > (chunk.coverSeasonal[k] ? SNOWY_SEASONAL : SNOWY);
      const season = plantLook(def, p.inst.seed, time, snow);
      const stage = stageOf(p.inst, time.totalMinutes);
      // Cuánto sufre (lo da el tile; los cultivos los cuida alguien)
      let s = 0;
      if (!p.inst.crop) {
        const t = (Math.floor(p.inst.cj / G) * WORLD.TILES + Math.floor(p.inst.ci / G)) * 32 + def.id;
        s = stress.get(t) ?? plantStress(chunk, Math.floor(p.inst.ci / G), Math.floor(p.inst.cj / G), def.id);
        stress.set(t, s);
      }
      const look: ArtLook = {
        ...FRESH, ...season, leaves: def.deciduous ? season.leaves : 1,
        fruit: lookStep(fruitOf(def, p.inst, time)), stress: lookStep(Math.max(s * 0.9, drowning(p.inst, time.totalMinutes))),
      };
      const [artKey, young] = artFor(def, stage);
      const id = `${artKey}|${young}|${JSON.stringify(look)}`;
      if (stage !== p.stage && !force) p.bounce = PLANT_ANIM_MS.bounce;
      p.stage = stage;
      if (id === p.look) continue;
      p.look = id;
      p.lastLook = look;
      p.artKey = artKey;
      p.young = young;
      p.sprite.texture = plantTexture(artKey, young, look);
      this.place(p);
    }
    for (const [r, sprite] of this.remains) this.placeRemains(r, sprite, time);
  }

  /** Avanza las animaciones (tiempo real) */
  update(dtMs: number): void {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      if (this.anims[i].update(dtMs)) {
        this.anims[i].destroy();
        this.anims.splice(i, 1);
      }
    }
    for (const p of this.placed.values()) {
      if (p.bounce <= 0) continue;
      p.bounce -= dtMs;
      this.place(p);
    }
    this.burnPlants(dtMs);
  }

  /** Llamas sobre las plantas a las que ha llegado el fuego del suelo (arden de abajo arriba) */
  private burnPlants(dtMs: number): void {
    const chunk = this.chunk;
    if (!chunk) return;
    this.fireScan -= dtMs;
    if (this.fireScan <= 0) {
      this.fireScan = FIRE_SCAN_MS;
      for (const p of this.placed.values()) {
        const i = Math.floor(p.inst.ci / G), j = Math.floor(p.inst.cj / G);
        const t = i + j * WORLD.TILES;
        let burning = false;
        if (chunk.fire[t] > 0) {
          const n = frontOrder(i, j, chunk.fireFrom[t]).indexOf(cellIndex(p.inst.ci, p.inst.cj));
          burning = n <= chunk.fireAge[t] * G * G + 1;
        }
        if (burning && !p.flame) {
          const size = plantSize(p.artKey || 'grass', p.young);
          const w = Math.max(3, Math.round(size.w * 0.8)), h = Math.max(4, Math.round(size.h * 0.95));
          const sprite = new Sprite(flameTexture(w, h, 0));
          this.view.addChild(sprite);
          p.flame = { sprite, w, h, frame: 0 };
        } else if (!burning && p.flame) {
          p.flame.sprite.destroy();
          p.flame = null;
        }
        if (p.flame) {
          p.flame.sprite.position.set(p.foot.x - Math.floor(p.flame.w / 2), p.foot.y - p.flame.h);
          p.flame.sprite.zIndex = p.foot.y + 0.1;
        }
      }
    }
    this.flicker -= dtMs;
    if (this.flicker > 0) return;
    this.flicker = FLICKER_MS;
    for (const p of this.placed.values()) {
      if (!p.flame) continue;
      p.flame.frame = (p.flame.frame + 1) % FLAME_FRAMES;
      p.flame.sprite.texture = flameTexture(p.flame.w, p.flame.h, p.flame.frame);
    }
  }

  /** Planta bajo un punto (local al contenedor del chunk), la de delante si hay varias */
  plantAt(x: number, y: number): PlantInstance | null {
    let best: PlacedPlant | null = null;
    for (const p of this.placed.values()) {
      const s = p.sprite;
      if (x < s.x || y < s.y || x >= s.x + s.texture.width || y >= s.y + s.texture.height - 1) continue;
      if (!best || s.zIndex > best.sprite.zIndex) best = p;
    }
    return best?.inst ?? null;
  }

  destroy(): void {
    for (const a of this.anims) a.destroy();
    this.anims.length = 0;
    this.view.destroy({ children: true });
  }

  // ── Colocar ──

  private footOf(inst: PlantInstance): { x: number; y: number } {
    // Los cultivos ocupan una casilla del cursor: se dibujan en su centro
    const top = inst.crop
      ? this.cellTop!(inst.ci + (BRUSH_CELLS - 1) / 2, inst.cj + (BRUSH_CELLS - 1) / 2)
      : this.cellTop!(inst.ci, inst.cj);
    return { x: Math.round(top.x), y: Math.round(top.y) };
  }

  private createPlaced(inst: PlantInstance, foot: { x: number; y: number }): PlacedPlant {
    const shadow = new Sprite();
    shadow.alpha = 1;
    const sprite = new Sprite();
    this.view.addChild(shadow, sprite);
    return { inst, sprite, shadow, foot, artKey: '', young: false, look: '', lastLook: FRESH, stage: Stage.ADULT, bounce: 0, flame: null };
  }

  /** Pone el sprite con el pie en su punto (y su sombra debajo) */
  private place(p: PlacedPlant): void {
    const size = plantSize(p.artKey, p.young);
    const hop = p.bounce > PLANT_ANIM_MS.bounce / 2 ? 1 : 0;
    p.sprite.position.set(p.foot.x - size.footX, p.foot.y - size.h + 1 - hop);
    p.sprite.zIndex = p.foot.y;
    // Sombra: más ancha cuanto más grande es la planta; un poco a la derecha (luz arriba a la izquierda)
    p.shadow.texture = shadowTexture(Math.max(3, size.w * (p.artKey === 'seed' ? 0.4 : 1)));
    p.shadow.position.set(p.foot.x + 1 - Math.floor(p.shadow.texture.width / 2), p.foot.y - Math.floor(p.shadow.texture.height / 2));
    p.shadow.zIndex = p.foot.y - 0.6;
  }

  private removePlaced(p: PlacedPlant): void {
    p.sprite.destroy();
    p.shadow.destroy();
    p.flame?.sprite.destroy();
  }

  private addTilled(foot: { x: number; y: number }): void {
    const soil = new Sprite(plantTexture('tilled', false, FRESH));
    const s = plantSize('tilled');
    soil.position.set(foot.x - s.footX, foot.y - s.h + 2);
    soil.zIndex = foot.y - 0.7;
    this.view.addChild(soil);
    this.tilled.push(soil);
  }

  // ── Restos (tocón, tronco caído, mata seca) ──

  private layoutRemains(time: GameTime): void {
    const now = new Set(remainsOf(this.chunk!));
    for (const [r, s] of this.remains) {
      if (now.has(r)) continue;
      s.destroy();
      this.remains.delete(r);
    }
    for (const r of now) {
      if (this.remains.has(r)) continue;
      const s = new Sprite();
      s.visible = !this.waiting.has(r.inst);
      this.view.addChild(s);
      this.remains.set(r, s);
      this.placeRemains(r, s, time);
    }
  }

  private placeRemains(r: PlantRemains, s: Sprite, time: GameTime): void {
    const foot = this.footOf(r.inst);
    const age = Math.min(1, (time.totalMinutes - r.at) / (REMAINS_DAYS[r.kind] * 1440));
    if (r.kind === 'log') {
      // Tronco tumbado: pierde las hojas y, si cayó al agua, se va hundiendo y apagando
      const f = fallTexture(PLANT_DEFS[r.inst.plant].key, { ...FRESH, dead: 1, leaves: 0.2 }, 90);
      s.texture = f.tex;
      const sink = r.cause === 'flood' ? Math.round(age * 3) : 0;
      s.position.set(foot.x - f.footX, foot.y - 2 - f.footY + sink);
      s.alpha = r.cause === 'flood' ? 1 - age * 0.6 : 1;
    } else {
      s.texture = plantTexture(r.kind, false, FRESH);
      const size = plantSize(r.kind);
      s.position.set(foot.x - size.footX, foot.y - size.h + 1);
      s.alpha = age > 0.8 ? 0.6 : 1;
    }
    s.zIndex = foot.y - 0.1;
  }

  // ── Animaciones ──

  private animateBirth(p: PlacedPlant): void {
    p.bounce = PLANT_ANIM_MS.bounce;
    // Destello: tres puntitos que suben y se apagan
    const dots = [[-3, -3], [3, -4], [0, -6]].map(([dx, dy]) => this.dot(SPARKLE, p.foot.x + dx, p.foot.y - 2 + dy, p.foot.y + 1));
    let t = 0;
    this.anims.push({
      update: dt => {
        t += dt;
        const k = t / PLANT_ANIM_MS.pop;
        dots.forEach((d, n) => { d.y -= dt * 0.006; d.alpha = Math.max(0, 1 - k) * (n % 2 ? 0.8 : 1); });
        return k >= 1;
      },
      destroy: () => dots.forEach(d => d.destroy()),
    });
  }

  private animateDeath(p: PlacedPlant, death: PlantDeath): void {
    const def = PLANT_DEFS[p.inst.plant];
    const sprite = p.sprite;
    p.shadow.destroy();
    p.flame?.sprite.destroy();
    p.flame = null;
    this.waiting.add(p.inst);
    const done = () => {
      this.waiting.delete(p.inst);
      for (const [r, s] of this.remains) if (r.inst === p.inst) s.visible = true;
    };
    const tree = def.kind === 'tree' && p.stage >= Stage.YOUNG && !p.young;
    if (tree && (death.cause === 'flood' || death.cause === 'uprooted')) this.anims.push(this.fall(p, sprite, done));
    else if (death.cause === 'flood') this.anims.push(this.sink(p, sprite, BUBBLE, PLANT_ANIM_MS.sink, done));
    else if (death.cause === 'buried') this.anims.push(this.sink(p, sprite, SAND_GRAIN, PLANT_ANIM_MS.bury, done));
    else this.anims.push(this.wither(p, sprite, death.cause, done));
  }

  /** El árbol se parte por la base y cae hacia delante (eje isométrico); al golpear saltan hojas */
  private fall(p: PlacedPlant, sprite: Sprite, done: () => void): Anim {
    let t = 0, burst: Sprite[] = [];
    const key = PLANT_DEFS[p.inst.plant].key;
    const look = { ...p.lastLook, dead: Math.max(p.lastLook.dead, 0.3) };
    const stump = new Sprite(plantTexture('stump', false, FRESH));
    const ss = plantSize('stump');
    stump.position.set(p.foot.x - ss.footX, p.foot.y - ss.h + 1);
    stump.zIndex = p.foot.y - 0.05;
    this.view.addChild(stump);
    return {
      update: dt => {
        t += dt;
        const k = Math.min(1, t / PLANT_ANIM_MS.fall);
        const angle = Math.round((90 * k * k) / 6) * 6;   // acelera al caer, en pasos de 6°
        const f = fallTexture(key, look, angle);
        sprite.texture = f.tex;
        sprite.position.set(p.foot.x - f.footX, p.foot.y - 2 - f.footY);
        if (k >= 1 && !burst.length) {
          sprite.visible = false;
          done();
          burst = Array.from({ length: 10 }, (_, n) =>
            this.dot(n % 2 ? 0x2f7d3a : 0x7a5630, p.foot.x + 3 + ((n * 7) % 13), p.foot.y - 1 + ((n * 5) % 5), p.foot.y + 2));
        }
        if (burst.length) burst.forEach((d, n) => { d.y -= dt * (n % 3 === 0 ? 0.01 : -0.004); d.alpha -= dt / 500; });
        return t >= PLANT_ANIM_MS.fall + 500;
      },
      destroy: () => { sprite.destroy(); stump.destroy(); burst.forEach(d => d.destroy()); },
    };
  }

  /** Se hunde: la parte de abajo desaparece bajo el agua (o la arena) mientras baja; burbujas o granos */
  private sink(p: PlacedPlant, sprite: Sprite, particle: number, ms: number, done: () => void): Anim {
    let t = 0, lastK = -1;
    const base = sprite.texture;
    const w = base.width, h = base.height;
    const x0 = sprite.x, y0 = sprite.y;
    const dots: Sprite[] = [];
    return {
      update: dt => {
        t += dt;
        const k = Math.min(h, Math.floor((t / ms) * (h + 1)));
        if (k !== lastK && k < h) {
          if (lastK >= 0) sprite.texture.destroy(false);
          sprite.texture = new Texture({ source: base.source, frame: new Rectangle(base.frame.x, base.frame.y, w, h - k) });
          sprite.position.set(x0 + (particle === SAND_GRAIN && k % 2 ? 1 : 0), y0 + k);
          lastK = k;
        }
        if (k >= h) sprite.visible = false;
        // Burbujas que suben (agua) o granos que caen (arena)
        if (dots.length < 6 && Math.random() < dt / 120) {
          const x = p.foot.x - 3 + Math.floor(Math.random() * 7);
          dots.push(this.dot(particle, x, particle === SAND_GRAIN ? p.foot.y - h - 2 : p.foot.y - 1, p.foot.y + 1));
        }
        for (const d of dots) {
          d.y += particle === SAND_GRAIN ? dt * 0.02 : -dt * 0.006;
          d.alpha = Math.max(0, d.alpha - dt / 900);
        }
        if (t >= ms) done();
        return t >= ms + 400;
      },
      destroy: () => { if (lastK >= 0) sprite.texture.destroy(false); sprite.destroy(); dots.forEach(d => d.destroy()); },
    };
  }

  /** Se seca del todo (se vuelve marrón) y se deshace en polvo */
  private wither(p: PlacedPlant, sprite: Sprite, cause: DeathCause, done: () => void): Anim {
    let t = 0;
    const quick = cause === 'cleared';
    const ms = (quick ? 0.3 : 1) * PLANT_ANIM_MS.wither, gone = PLANT_ANIM_MS.dissolve;
    let last = '';
    return {
      update: dt => {
        t += dt;
        const dead = lookStep(t / ms), dissolve = lookStep((t - ms) / gone);
        const look = { ...p.lastLook, dead, gone: dissolve, fruit: 0 };
        const id = `${dead}|${dissolve}`;
        if (id !== last) {
          last = id;
          sprite.texture = plantTexture(p.artKey, p.young, look);
        }
        if (t >= ms) done();
        return t >= ms + gone;
      },
      destroy: () => sprite.destroy(),
    };
  }

  /** Un píxel suelto (partícula) */
  private dot(color: number, x: number, y: number, z: number): Sprite {
    const d = new Sprite(Texture.WHITE);
    d.tint = color;
    d.width = 1;
    d.height = 1;
    d.position.set(x, y);
    d.zIndex = z;
    this.view.addChild(d);
    return d;
  }
}

/** Qué dibujo usa una planta en cada etapa: semilla y brote son comunes; joven es su dibujo más pequeño */
function artFor(def: PlantDef, stage: Stage): [string, boolean] {
  if (stage === Stage.SEED) return ['seed', false];
  if (stage === Stage.SPROUT) return ['sprout', false];
  return [def.key, stage === Stage.YOUNG];
}

/**
 * Fruto que se ve ahora (0..1): solo en su temporada (madura en sus primeros días) y si no se lo han comido
 * (vuelve poco a poco). Solo las plantas con frutos dibujados. En modo desarrollo se puede ver todo el año.
 */
function fruitOf(def: PlantDef, inst: PlantInstance, time: GameTime): number {
  if (!def.food || !PLANT_ART[def.key]?.parts.some(p => p.kind === 'fruit')) return 0;
  const seasons = def.food.seasons;
  let ripe = 1;
  if (seasons && !plantDevFlags.fruitAllYear) {
    if (!seasons.includes(time.season)) return 0;
    const prev = ((time.season + 3) % 4) as SeasonId;
    if (!seasons.includes(prev)) ripe = Math.min(1, (time.dayOfSeason - 1 + time.minuteOfDay / 1440) / FRUIT_RIPEN_DAYS);
  }
  const regrow = Number.isFinite(inst.eatenAt) ? Math.min(1, (time.totalMinutes - inst.eatenAt) / (FRUIT_REGROW_DAYS * 1440)) : 1;
  return ripe * regrow;
}
