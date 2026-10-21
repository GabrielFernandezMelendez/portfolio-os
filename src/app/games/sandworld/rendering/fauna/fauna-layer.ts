import { Container, Graphics, Sprite } from 'pixi.js';
import { Animal } from '../../domain/models/animal.model';
import { SPECIES_DEFS } from '../../config/species.config';
import {
  COIN, DEER_CANVAS, DEER_SCALE, DEER_SHADOW, FAUNA_ANIM, FAUNA_LOD, FAUNA_SMOOTH_MS, SELECT_COLOR, SELECT_HALF_W, SIGNAL_ANIM,
} from '../../config/fauna-art.config';
import { signalTexture } from './signal-art';
import { badgeTexture, coinTexture } from './coin-art';
import { HerdMark } from '../../application/fauna/herds';
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
  /** Manadas para la vista de lejos (solo se piden cuando hacen falta) */
  herds(): readonly HerdMark[];
}

/** Moneda de una manada en la vista de lejos */
interface Coin {
  readonly view: Container;
  readonly coin: Sprite;
  readonly badge: Sprite;
  readonly shadow: Sprite;
  leader: number;
  count: number;
  x: number;
  y: number;
  placed: boolean;
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
  /** Signo sobre la cabeza ('!' o '?'): se crea al primer susto; `signalAt` = cuál está enseñando, `signalMs` = desde cuándo */
  signal: Sprite | null;
  signalAt: number;
  signalMs: number;
}

/**
 * Animales en el mapa. Cada uno es un sprite dentro del contenedor del chunk donde está (así se ordena por
 * profundidad con las plantas: pasa por delante o por detrás de un árbol) y cambia de contenedor al cruzar
 * a otro chunk. Su posición se suaviza entre minuto y minuto de juego; la animación va en tiempo real
 * (se congela en pausa). El seleccionado lleva un rombo y una flecha encima.
 */
export class FaunaLayer {
  private readonly shown = new Map<number, Shown>();
  private readonly coins = new Map<number, Coin>();
  /**
   * Capa de las monedas, encima de todo el terreno y las plantas (de lejos tienen que leerse siempre, no
   * esconderse detrás de un árbol). El runtime la añade al mundo; usa coordenadas del mundo.
   */
  readonly overlay = new Container();
  /** ¿Vista de lejos (monedas)? */
  private far = false;
  private readonly marker = new Container();
  private readonly ring = new Graphics();
  private readonly arrow = new Graphics();
  private clock = 0;

  constructor() {
    this.overlay.zIndex = 1e5;
    this.overlay.sortableChildren = true;
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

  /**
   * Un frame: coloca, anima y ordena a todos los animales (y cadáveres). Con la cámara lejos (zoom por debajo de
   * FAUNA_LOD.coinsBelow) dibuja una moneda por manada y no anima a nadie.
   */
  update(dtMs: number, view: FaunaView, groundAt: GroundAt, paused: boolean, zoom: number): void {
    if (!paused) this.clock += dtMs;
    const far = zoom < FAUNA_LOD.coinsBelow;
    if (far !== this.far) {
      this.far = far;
      // Al cambiar de vista, los que se ocultan dejan de verse y los que vuelven se colocan de golpe
      for (const s of this.shown.values()) {
        s.sprite.visible = s.shadow.visible = !far;
        if (s.signal) s.signal.visible = false;
        s.placed = false;
      }
      for (const c of this.coins.values()) {
        c.view.visible = far;
        c.placed = false;
      }
    }
    if (far) {
      this.marker.visible = false;
      this.updateCoins(dtMs, view, groundAt);
      return;
    }
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
      this.showSignal(s, a, view, paused ? 0 : dtMs);
    }
    for (const [id, s] of this.shown) {
      if (seen.has(id)) continue;
      s.sprite.destroy();
      s.shadow.destroy();
      s.signal?.destroy();
      this.shown.delete(id);
    }
    this.placeMarker(view.selected);
  }

  /** Animal dibujado bajo un punto del mundo (el de delante), o null. De lejos, la guía de la moneda tocada. */
  animalAt(wx: number, wy: number): number | null {
    let best: number | null = null, bestY = -Infinity;
    if (this.far) {
      const r = COIN.size / 2 + 2;
      for (const c of this.coins.values()) {
        if (!c.view.visible || Math.hypot(wx - c.x, wy - (c.y - r)) > r) continue;
        if (c.y > bestY) {
          bestY = c.y;
          best = c.leader;
        }
      }
      return best;
    }
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
    for (const c of this.coins.values()) c.view.destroy({ children: true });
    this.coins.clear();
    this.overlay.destroy({ children: true });
    for (const s of this.shown.values()) {
      s.sprite.destroy();
      s.shadow.destroy();
      s.signal?.destroy();
    }
    this.shown.clear();
    this.marker.destroy({ children: true });
  }

  /** Una moneda por manada, donde está su guía (en la capa de encima, ordenadas entre ellas de atrás adelante) */
  private updateCoins(dtMs: number, view: FaunaView, groundAt: GroundAt): void {
    const seen = new Set<number>();
    for (const h of view.herds()) {
      const ground = groundAt(Math.floor(h.x), Math.floor(h.y));
      if (!ground) continue;
      seen.add(h.herd);
      let c = this.coins.get(h.herd);
      if (!c) {
        c = this.createCoin(SPECIES_DEFS[h.species].key);
        this.coins.set(h.herd, c);
      }
      if (c.view.parent !== this.overlay) this.overlay.addChild(c.view);
      if (c.count !== h.count) {
        c.count = h.count;
        c.badge.texture = badgeTexture(h.count);
      }
      c.leader = h.leader;
      c.view.visible = true;
      // Posición suavizada, como la de los animales (salta si viene de lejos: otro chunk, otra guía)
      const p = ground.point(h.x, h.y);
      if (!c.placed || Math.hypot(p.x - c.x, p.y - c.y) > 40) {
        c.x = p.x;
        c.y = p.y;
        c.placed = true;
      } else {
        const k = 1 - Math.exp(-dtMs / FAUNA_SMOOTH_MS);
        c.x += (p.x - c.x) * k;
        c.y += (p.y - c.y) * k;
      }
      c.view.position.set(Math.round(c.x), Math.round(c.y));
      c.view.zIndex = c.y + 0.05;
    }
    for (const [id, c] of this.coins) {
      if (seen.has(id)) continue;
      c.view.destroy({ children: true });
      this.coins.delete(id);
    }
  }

  private createCoin(species: string): Coin {
    const view = new Container();
    const shadow = new Sprite(shadowTexture(COIN.shadow));
    shadow.anchor.set(0.5, 0.5);
    shadow.position.set(1, 0);
    const coin = new Sprite(coinTexture(species));
    coin.anchor.set(0.5, 1);
    coin.position.set(0, 1);
    const badge = new Sprite(badgeTexture(0));
    badge.anchor.set(0, 1);
    badge.position.set(3, 3);
    view.addChild(shadow, coin, badge);
    return { view, coin, badge, shadow, leader: -1, count: 0, x: 0, y: 0, placed: false };
  }

  private create(): Shown {
    const sprite = new Sprite();
    sprite.anchor.set(DEER_CANVAS.footX / DEER_CANVAS.w, DEER_CANVAS.ground / DEER_CANVAS.h);
    const shadow = new Sprite();
    shadow.anchor.set(0.5, 0.5);
    return { sprite, shadow, parent: null, x: 0, y: 0, placed: false, pose: 'idle', frame: 0, frameMs: 0, kind: 'female', signal: null, signalAt: -1, signalMs: 0 };
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

  /**
   * '!' o '?' sobre la cabeza unos segundos (tiempo real; se congela en pausa): sale con un saltito, se balancea un
   * píxel y se desvanece. Solo se crea el sprite cuando hace falta y solo se ve en los animales en pantalla.
   */
  private showSignal(s: Shown, a: Animal, view: FaunaView, dtMs: number): void {
    const sig = a.diedAt === null ? a.signal : null;
    if (sig && sig.at !== s.signalAt) {
      s.signalAt = sig.at;
      // Si el signo es de hace rato (el animal acaba de entrar en pantalla), no se enseña
      s.signalMs = view.now - sig.at > 2 ? SIGNAL_ANIM.ms : 0;
      if (!s.signal) {
        s.signal = new Sprite();
        s.signal.anchor.set(0.5, 1);
      }
      s.signal.texture = signalTexture(sig.kind);
    }
    if (!s.signal) return;
    s.signalMs += dtMs;
    const t = s.signalMs;
    if (!sig || t >= SIGNAL_ANIM.ms) {
      s.signal.visible = false;
      return;
    }
    if (s.signal.parent !== s.parent) s.parent?.addChild(s.signal);
    const popFrame = Math.floor(t / SIGNAL_ANIM.popMs);
    const dy = popFrame < SIGNAL_ANIM.pop.length ? SIGNAL_ANIM.pop[popFrame] : -(Math.floor(t / SIGNAL_ANIM.bobMs) % 2);
    const lift = view.selected === a.id ? SIGNAL_ANIM.selectedLift : 0;
    s.signal.visible = s.sprite.visible;
    s.signal.alpha = Math.min(1, (SIGNAL_ANIM.ms - t) / SIGNAL_ANIM.fadeMs) * (popFrame === 0 ? 0.6 : 1);
    s.signal.position.set(Math.round(s.x), Math.round(s.y) - SIGNAL_ANIM.head[s.kind] - lift + dy);
    s.signal.zIndex = s.y + 0.06;
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
