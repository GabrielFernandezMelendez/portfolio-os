import { Container, Graphics, Sprite } from 'pixi.js';
import { Animal } from '../../domain/models/animal.model';
import { SPECIES_DEFS } from '../../config/species.config';
import { DEER_CANVAS, DEER_SCALE, DEER_SHADOW, FAUNA_ANIM, FAUNA_SMOOTH_MS, SELECT_COLOR, SELECT_HALF_W } from '../../config/fauna-art.config';
import { DeerKind, DeerPose } from './deer-art';
import { deerTexture } from './fauna-sprites';
import { shadowTexture } from '../vegetation/plant-sprites';
import { ageDays } from '../../application/fauna/needs';

/** Lo que el dibujo necesita de la fauna (solo lee) */
export interface FaunaView {
  readonly animals: readonly Animal[];
  readonly corpses: readonly Animal[];
  readonly selected: number | null;
  /** Minuto de juego (edad de cada animal y cadáveres que se desvanecen) */
  readonly now: number;
}

/** Suelo de una celda global: contenedor del chunk (para ordenarse con sus plantas) y punto del mundo */
export interface Ground {
  readonly container: Container;
  /** Punto del mundo de una posición con decimales (celdas globales) */
  point(gx: number, gy: number): { x: number; y: number };
}
export type GroundAt = (gx: number, gy: number) => Ground | null;

interface Shown {
  readonly sprite: Sprite;
  readonly shadow: Sprite;
  parent: Container | null;
  x: number;
  y: number;
  placed: boolean;
  pose: DeerPose;
  frame: number;
  frameMs: number;
  kind: DeerKind;
}

/**
 * Animales en el mapa. Cada uno es un sprite dentro del contenedor del chunk donde está (así se ordena por
 * profundidad con las plantas: pasa por delante o por detrás de un árbol) y cambia de contenedor al cruzar
 * a otro chunk. Su posición se suaviza entre minuto y minuto de juego; la animación va en tiempo real
 * (se congela en pausa). El seleccionado lleva un rombo y una flecha encima.
 */
export class FaunaLayer {
  private readonly shown = new Map<number, Shown>();
  private readonly marker = new Container();
  private readonly ring = new Graphics();
  private readonly arrow = new Graphics();
  private clock = 0;

  constructor() {
    // Rombo isométrico alrededor del pie: solo sus cuatro esquinas (como el cursor del pincel)
    const w = SELECT_HALF_W, h = w / 2, f = 0.3;
    const pts = [[0, -h], [w, 0], [0, h], [-w, 0]];
    pts.forEach(([x, y], i) => {
      const [px, py] = pts[(i + 3) % 4], [nx, ny] = pts[(i + 1) % 4];
      this.ring.moveTo(x + (px - x) * f, y + (py - y) * f).lineTo(x, y).lineTo(x + (nx - x) * f, y + (ny - y) * f);
    });
    this.ring.stroke({ width: 1, color: SELECT_COLOR, alpha: 1 });
    this.arrow.poly([-3, 0, 3, 0, 0, 3]).fill(SELECT_COLOR).stroke({ width: 1, color: 0x2e1a0d });
    this.marker.addChild(this.ring, this.arrow);
    this.marker.visible = false;
  }

  /** Un frame: coloca, anima y ordena a todos los animales (y cadáveres) */
  update(dtMs: number, view: FaunaView, groundAt: GroundAt, paused: boolean): void {
    if (!paused) this.clock += dtMs;
    const seen = new Set<number>();
    for (const a of [...view.animals, ...view.corpses]) {
      seen.add(a.id);
      const ground = groundAt(Math.floor(a.x), Math.floor(a.y));
      let s = this.shown.get(a.id);
      if (!ground) {
        if (s) s.sprite.visible = s.shadow.visible = false;
        continue;
      }
      if (!s) {
        s = this.create();
        this.shown.set(a.id, s);
      }
      s.sprite.visible = s.shadow.visible = true;
      // Contenedor del chunk en el que está
      if (s.parent !== ground.container) {
        ground.container.addChild(s.shadow, s.sprite);
        s.parent = ground.container;
      }
      // Posición suavizada (salta de golpe si viene de lejos o es la primera vez)
      const p = ground.point(a.x, a.y);
      if (!s.placed || Math.hypot(p.x - s.x, p.y - s.y) > 40) {
        s.x = p.x;
        s.y = p.y;
        s.placed = true;
      } else {
        const k = 1 - Math.exp(-dtMs / FAUNA_SMOOTH_MS);
        s.x += (p.x - s.x) * k;
        s.y += (p.y - s.y) * k;
      }
      this.animate(s, a, view.now, paused ? 0 : dtMs);
    }
    for (const [id, s] of this.shown) {
      if (seen.has(id)) continue;
      s.sprite.destroy();
      s.shadow.destroy();
      this.shown.delete(id);
    }
    this.placeMarker(view.selected);
  }

  /** Animal dibujado bajo un punto del mundo (el de delante), o null */
  animalAt(wx: number, wy: number): number | null {
    let best: number | null = null, bestY = -Infinity;
    for (const [id, s] of this.shown) {
      if (!s.sprite.visible) continue;
      const k = DEER_SCALE[s.kind];
      const half = 9 * k, top = 22 * k;
      if (wx < s.x - half || wx > s.x + half || wy < s.y - top || wy > s.y + 3) continue;
      if (s.y > bestY) {
        bestY = s.y;
        best = id;
      }
    }
    return best;
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      s.sprite.destroy();
      s.shadow.destroy();
    }
    this.shown.clear();
    this.marker.destroy({ children: true });
  }

  private create(): Shown {
    const sprite = new Sprite();
    sprite.anchor.set(DEER_CANVAS.footX / DEER_CANVAS.w, DEER_CANVAS.ground / DEER_CANVAS.h);
    const shadow = new Sprite();
    shadow.anchor.set(0.5, 0.5);
    return { sprite, shadow, parent: null, x: 0, y: 0, placed: false, pose: 'idle', frame: 0, frameMs: 0, kind: 'female' };
  }

  /** Textura del fotograma que toca, espejo según hacia dónde mira, profundidad y sombra */
  private animate(s: Shown, a: Animal, now: number, dtMs: number): void {
    const species = SPECIES_DEFS[a.species];
    const kind: DeerKind = ageDays(a, now) < species.youngDays ? 'fawn' : a.sex;
    const pose: DeerPose = a.action;
    if (pose !== s.pose) {
      s.pose = pose;
      s.frame = 0;
      s.frameMs = 0;
    }
    const anim = FAUNA_ANIM[pose];
    s.frameMs += dtMs;
    const dur = anim.ms[s.frame % anim.ms.length];
    if (anim.frames > 1 && s.frameMs >= dur) {
      s.frameMs -= dur;
      s.frame = (s.frame + 1) % anim.frames;
    }
    s.kind = kind;
    s.sprite.texture = deerTexture(kind, pose, s.frame, a.back);
    // El dibujo mira a la izquierda de frente y a la derecha de espaldas: el resto, en espejo
    const flip = a.back ? a.facing === -1 : a.facing === 1;
    s.sprite.scale.x = flip ? -1 : 1;
    s.sprite.position.set(Math.round(s.x), Math.round(s.y));
    s.sprite.zIndex = s.y + 0.05;
    // Los cadáveres se desvanecen el último día
    if (a.diedAt !== null) {
      const left = species.corpseDays - (now - a.diedAt) / 1440;
      s.sprite.alpha = Math.max(0, Math.min(1, left));
    } else s.sprite.alpha = 1;
    s.shadow.texture = shadowTexture(Math.round(DEER_SHADOW * (DEER_SCALE[kind] / DEER_SCALE.female)));
    s.shadow.position.set(Math.round(s.x) + 1, Math.round(s.y));
    s.shadow.zIndex = s.y - 0.6;
    s.shadow.alpha = s.sprite.alpha;
  }

  /** Rombo y flecha sobre el seleccionado (en el contenedor de su chunk, encima de todo lo de ese chunk) */
  private placeMarker(selected: number | null): void {
    const s = selected !== null ? this.shown.get(selected) : undefined;
    if (!s || !s.parent || !s.sprite.visible) {
      this.marker.visible = false;
      return;
    }
    if (this.marker.parent !== s.parent) s.parent.addChild(this.marker);
    this.marker.visible = true;
    this.marker.position.set(Math.round(s.x), Math.round(s.y));
    this.marker.zIndex = s.y + 0.04;
    const bob = Math.round(Math.abs(Math.sin(this.clock / 260)) * 2);
    this.arrow.position.set(0, -Math.round(26 * DEER_SCALE[s.kind]) - bob);
    this.arrow.zIndex = 1;
  }
}
