import { Container, Graphics, Sprite } from 'pixi.js';
import { Animal, Burrow } from '../../domain/models/animal.model';
import { SPECIES_DEFS } from '../../config/species.config';
import {
  COIN, COMBAT_FX, FAUNA_ANIM, FAUNA_COMBAT, FAUNA_CROUCH, FAUNA_LOD, FAUNA_SMOOTH_MS, SELECT_COLOR, SELECT_HALF_W, SIGNAL_ANIM,
  SPECIES_ART,
} from '../../config/fauna-art.config';
import { signalTexture } from './signal-art';
import { CombatFx } from './combat-fx';
import { badgeTexture, coinTexture } from './coin-art';
import { HerdMark } from '../../application/fauna/herds';
import { FaunaPose, animalTexture, artKind, artVariant, refugeTexture } from './fauna-sprites';
import { FLY_FROM } from '../../config/fauna.config';
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
  /** Madrigueras (entradas en el suelo) */
  readonly burrows: readonly Burrow[];
  /** ¿Sangre en los combates? (Ajustes) */
  readonly blood: boolean;
}

/** Entrada de madriguera dibujada */
interface Hole {
  readonly sprite: Sprite;
  state: 'digging' | 'open' | 'blocked';
  placed: boolean;
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
  pose: FaunaPose;
  /** Aves: altura de vuelo actual (px de mundo), que sube y baja suave al despegar y al posarse */
  lift: number;
  frame: number;
  frameMs: number;
  species: string;
  kind: string;
  /** Dentro de su madriguera: no se dibuja (pero sigue aquí, para el marcador de selección en la entrada) */
  hidden: boolean;
  /** Signo sobre la cabeza ('!' o '?'): se crea al primer susto; `signalAt` = cuál está enseñando, `signalMs` = desde cuándo */
  signal: Sprite | null;
  signalAt: number;
  /** Cuerpo a cuerpo: ms reales luchando (marca el ritmo de los golpes), último ciclo en que embistió y en que recibió */
  fightMs: number;
  lastLunge: number;
  lastHit: number;
  /** Huyendo herido: ms desde la última gota del rastro */
  dripMs: number;
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
  private readonly holes = new Map<number, Hole>();
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
  private readonly fx = new CombatFx();
  private blood = true;

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
    this.updateHoles(view, groundAt);
    if (far) {
      this.marker.visible = false;
      this.updateCoins(dtMs, view, groundAt, zoom);
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
      // Dentro de la madriguera no se ve (ni su sombra, ni su signo)
      s.hidden = a.inside !== null;
      s.sprite.visible = s.shadow.visible = !s.hidden;
      if (s.hidden && s.signal) s.signal.visible = false;
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
      if (s.hidden) continue;
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
    this.combat(view, paused ? 0 : dtMs);
    this.placeMarker(view.selected);
  }

  /**
   * Combate (solo dibujo): los que luchan se turnan los golpes en ciclos de FAUNA_COMBAT.cycleMs (el reloj es el del
   * cazador, para que los dos vayan a la par): quien golpea se echa atrás y embiste; quien lo recibe parpadea en blanco,
   * retrocede y tiembla, y salta sangre (o una chispa si está desactivada). Además: charco bajo los que mueren
   * luchando o cazados, y rastro de gotas del que huye herido.
   */
  private combat(view: FaunaView, dtMs: number): void {
    const F = FAUNA_COMBAT;
    if (view.blood !== this.blood) {
      this.blood = view.blood;
      if (!view.blood) this.fx.clearBlood();
    }
    let byId: Map<number, Animal> | null = null;
    for (const a of view.animals) {
      const s = this.shown.get(a.id);
      if (!s || s.hidden || !s.parent) continue;
      // Huye herido: deja un rastro de gotas
      if (view.blood && a.action === 'run' && a.health < 0.95 && a.signal?.kind === 'flee') {
        s.dripMs += dtMs;
        if (s.dripMs >= COMBAT_FX.dripMs) {
          s.dripMs = 0;
          this.fx.drip(s.parent, s.x, s.y, view.now);
        }
      }
      if (a.action !== 'fight' || !a.fight) {
        s.fightMs = 0;
        s.lastLunge = s.lastHit = -1;
        continue;
      }
      byId ??= new Map(view.animals.map(x => [x.id, x]));
      const foe = byId.get(a.fight.with), o = this.shown.get(a.fight.with);
      if (!foe || !o) continue;
      s.fightMs += dtMs;
      const hunter = a.hunt?.target === foe.id;
      const prey = hunter ? foe : a;
      const ps = SPECIES_DEFS[prey.species];
      const fightsBack = !!ps.defend || !!ps.predator;
      // Reloj del par: el del cazador
      const ms = hunter ? s.fightMs : o.fightMs || s.fightMs;
      const n = Math.floor(ms / F.cycleMs), t = ms % F.cycleMs;
      const hunterTurn = n % 2 === 0 || !fightsBack;
      const striking = hunter === hunterTurn;
      // Se dibujan de lado, encarados a una distancia mínima (en la simulación están casi en el mismo sitio): cada uno a
      // un lado del otro (si están a la par, el orden de sus ids decide quién va a cada lado, y los dos lo ven igual)
      const gap = o.x - s.x;
      const side = Math.abs(gap) > 0.5 ? Math.sign(gap) : a.id < foe.id ? 1 : -1;
      const dx = side, dy = 0;
      const apart = Math.max(0, (F.standoffPx - Math.abs(gap)) / 2);
      let ox = -side * apart, oy = 0, pose: FaunaPose = 'idle', flash = false;
      if (striking) {
        const k = t < F.windup[1] ? -F.backPx : t < F.lunge[1] ? F.lungePx : t < F.impact[1] ? F.lungePx * 0.6 : 0;
        ox += dx * k;
        oy += dy * k;
        if (t >= F.lunge[0] && t < F.impact[1]) pose = 'fight';
        if (t >= F.lunge[0] && s.lastLunge !== n) {
          s.lastLunge = n;
          this.fx.dust(s.parent, s.x + ox, s.y + oy, Math.sign(dx));
        }
      } else if (t >= F.impact[0] && t < F.impact[1]) {
        const shake = Math.floor((t - F.impact[0]) / F.shakeMs) % 2 ? F.shakePx : -F.shakePx;
        ox += -dx * F.knockPx + shake;
        oy += -dy * F.knockPx;
        flash = t - F.impact[0] < F.flashMs;
        if (s.lastHit !== n) {
          s.lastHit = n;
          this.fx.hit(s.parent, s.x + ox, s.y + oy, -Math.sign(dx) || 1, view.blood, false);
        }
      }
      const key = s.species;
      // De frente y mirando al otro (el dibujo mira a la izquierda: a la derecha, en espejo)
      s.sprite.texture = animalTexture(key, s.kind, pose, 0, false, artVariant(key, a.id), flash);
      const dens = 1 / (SPECIES_ART[key].density ?? 1);
      s.sprite.scale.set(side > 0 ? -dens : dens, dens);
      s.sprite.position.set(Math.round(s.x + ox), Math.round(s.y + oy - s.lift));
    }
    // Charco bajo los que han muerto luchando o cazados (con su cadáver; se va con él)
    const keep = new Set<number>();
    if (view.blood) {
      for (const c of view.corpses) {
        if (c.cause !== 'predation' && c.cause !== 'injury') continue;
        const s = this.shown.get(c.id);
        if (!s || !s.parent || !s.sprite.visible) continue;
        keep.add(c.id);
        this.fx.pool(c.id, s.parent, s.x, s.y, COMBAT_FX.pool[SPECIES_DEFS[c.species].size], s.sprite.alpha);
      }
    }
    this.fx.keepPools(keep);
    this.fx.update(dtMs, view.now);
  }

  /** Animal dibujado bajo un punto del mundo (el de delante), o null. De lejos, la guía de la moneda tocada. */
  animalAt(wx: number, wy: number): number | null {
    let best: number | null = null, bestY = -Infinity;
    if (this.far) {
      for (const c of this.coins.values()) {
        // La moneda puede estar agrandada (zoom por debajo de ×1): el toque, igual
        const r = (COIN.size / 2 + 2) * c.view.scale.x;
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
      const art = SPECIES_ART[s.species], k = art.scale[s.kind] / Math.max(...Object.values(art.scale));
      const half = art.hit.half * k, top = art.hit.top * k;
      const y = s.y - s.lift;
      if (wx < s.x - half || wx > s.x + half || wy < y - top || wy > y + 3) continue;
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
    for (const h of this.holes.values()) h.sprite.destroy();
    this.holes.clear();
    this.overlay.destroy({ children: true });
    this.fx.destroy();
    for (const s of this.shown.values()) {
      s.sprite.destroy();
      s.shadow.destroy();
      s.signal?.destroy();
    }
    this.shown.clear();
    this.marker.destroy({ children: true });
  }

  /** Una moneda por manada, donde está su guía (en la capa de encima, ordenadas entre ellas de atrás adelante) */
  private updateCoins(dtMs: number, view: FaunaView, groundAt: GroundAt, zoom: number): void {
    // Con zoom por debajo de ×1 (la isla entera) las monedas no encogen: se quedan del tamaño de ×1 en pantalla
    const grow = zoom < 1 ? 1 / zoom : 1;
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
      c.view.scale.set(grow);
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
    coin.scale.set(COIN.size / coin.texture.width);
    coin.position.set(0, 1);
    const badge = new Sprite(badgeTexture(0));
    badge.anchor.set(0, 1);
    badge.position.set(3, 3);
    view.addChild(shadow, coin, badge);
    return { view, coin, badge, shadow, leader: -1, count: 0, x: 0, y: 0, placed: false };
  }

  /**
   * Entradas de madriguera: en el contenedor de su chunk, justo por debajo de los animales que pasan por encima.
   * Mientras la cavan, solo el montón de tierra; tapada por la Duna, con arena en el agujero.
   */
  private updateHoles(view: FaunaView, groundAt: GroundAt): void {
    const seen = new Set<number>();
    for (const b of view.burrows) {
      const ground = groundAt(Math.floor(b.x), Math.floor(b.y));
      if (!ground) continue;
      seen.add(b.id);
      let h = this.holes.get(b.id);
      const state = b.readyAt > view.now ? 'digging' : b.blocked ? 'blocked' : 'open';
      if (!h) {
        h = { sprite: new Sprite(), state: 'open', placed: false };
        this.holes.set(b.id, h);
        ground.container.addChild(h.sprite);
      }
      if (state !== h.state || !h.placed) {
        h.state = state;
        const art = refugeTexture(b.kind, state);
        h.sprite.texture = art.texture;
        // El punto de la entrada del dibujo, sobre la entrada en el mundo
        h.sprite.anchor.set(art.footX / art.w, art.footY / art.h);
        h.sprite.scale.set(1 / art.density);
        const p = ground.point(b.x, b.y);
        h.sprite.position.set(Math.round(p.x), Math.round(p.y) - art.lift);
        // La madriguera es un agujero en el suelo (debajo de todo); la cueva y la guarida, con volumen (se ordenan);
        // el nido, en la copa, por delante del árbol que lo sostiene
        h.sprite.zIndex = b.kind === 'burrow' ? p.y - 3 : art.lift > 0 ? p.y + 0.3 : p.y - 0.2;
        h.placed = true;
      }
    }
    for (const [id, h] of this.holes) {
      if (seen.has(id)) continue;
      h.sprite.destroy();
      this.holes.delete(id);
    }
  }

  private create(): Shown {
    const sprite = new Sprite();
    const shadow = new Sprite();
    shadow.anchor.set(0.5, 0.5);
    return {
      sprite, shadow, parent: null, x: 0, y: 0, placed: false, pose: 'idle', lift: 0, frame: 0, frameMs: 0, species: '', kind: 'female', hidden: false,
      signal: null, signalAt: -1, signalMs: 0, fightMs: 0, lastLunge: -1, lastHit: -1, dripMs: 0,
    };
  }

  /** Textura del fotograma que toca, espejo según hacia dónde mira, profundidad y sombra */
  private animate(s: Shown, a: Animal, now: number, dtMs: number): void {
    const species = SPECIES_DEFS[a.species];
    const art = SPECIES_ART[species.key];
    if (s.species !== species.key) {
      // Cada especie tiene su lienzo: el pie (punto de apoyo) en su sitio
      s.species = species.key;
      s.sprite.anchor.set(art.canvas.footX / art.canvas.w, art.canvas.ground / art.canvas.h);
    }
    const kind = artKind(species.key, ageDays(a, now) < species.youngDays, a.sex);
    const pose = this.poseOf(a);
    if (pose !== s.pose) {
      s.pose = pose;
      s.frame = 0;
      s.frameMs = 0;
    }
    const anim = FAUNA_ANIM[pose];
    // Agachado acechando: los pasos van más despacio
    const crouch = !!a.hunt?.crouch && a.action === 'walk';
    s.frameMs += dtMs * (crouch ? FAUNA_CROUCH.steps : 1);
    const dur = anim.ms[s.frame % anim.ms.length];
    if (anim.frames > 1 && s.frameMs >= dur) {
      s.frameMs -= dur;
      s.frame = (s.frame + 1) % anim.frames;
    }
    s.kind = kind;
    s.sprite.texture = animalTexture(species.key, kind, pose, s.frame, a.back, artVariant(species.key, a.id));
    // El dibujo mira a la izquierda de frente y a la derecha de espaldas: el resto, en espejo. Las especies en alta
    // densidad se encogen a su tamaño de mundo
    const flip = a.back ? a.facing === -1 : a.facing === 1;
    const d = 1 / (art.density ?? 1);
    s.sprite.scale.set(flip ? -d : d, d * (crouch ? FAUNA_CROUCH.squash : 1));
    s.sprite.tint = crouch ? FAUNA_CROUCH.tint : 0xffffff;
    // En vuelo, el sprite sube (la sombra se queda en el suelo); al posarse, baja
    const goal = pose === 'fly' ? art.flyLift ?? 0 : 0;
    s.lift += (goal - s.lift) * (1 - Math.exp(-dtMs / 260));
    if (Math.abs(goal - s.lift) < 0.3) s.lift = goal;
    s.sprite.position.set(Math.round(s.x), Math.round(s.y - s.lift));
    s.sprite.zIndex = s.y + 0.05;
    // Los cadáveres se desvanecen el último día
    if (a.diedAt !== null) {
      const left = species.corpseDays - (now - a.diedAt - (a.kept ?? 0)) / 1440;
      s.sprite.alpha = Math.max(0, Math.min(1, left));
    } else s.sprite.alpha = 1;
    s.shadow.texture = shadowTexture(Math.round(art.shadow * (art.scale[kind] / art.scale['female'])));
    s.shadow.position.set(Math.round(s.x) + 1, Math.round(s.y));
    s.shadow.zIndex = s.y - 0.6;
    s.shadow.alpha = s.sprite.alpha;
  }

  /**
   * Pose a dibujar: la acción del animal, salvo las aves que van lejos o huyen (en vuelo) y los cazadores que
   * persiguen a su presa (arma en alto). Solo lee el estado de la simulación.
   */
  private poseOf(a: Animal): FaunaPose {
    const s = SPECIES_DEFS[a.species];
    if (s.locomotion === 'fly' && a.diedAt === null) {
      if (a.action === 'run') return 'fly';
      if (a.action === 'walk' && Math.hypot(a.tx - a.x, a.ty - a.y) > FLY_FROM) return 'fly';
    }
    if (a.hunt?.phase === 'chase' && a.action === 'run') return 'hunt';
    // Cuerpo a cuerpo: quietos y encarados; las embestidas las pone combat()
    if (a.action === 'fight') return 'idle';
    return a.action;
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
    // La espada se queda mientras dura el cuerpo a cuerpo (sin desvanecerse: balanceándose)
    if (sig?.kind === 'fight' && a.action === 'fight') s.signalMs = Math.min(s.signalMs, SIGNAL_ANIM.ms - SIGNAL_ANIM.fadeMs - 1);
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
    s.signal.position.set(Math.round(s.x), Math.round(s.y - s.lift) - SPECIES_ART[s.species].head[s.kind] - lift + dy);
    s.signal.zIndex = s.y + 0.06;
  }

  /** Rombo y flecha sobre el seleccionado (en el contenedor de su chunk, encima de todo lo de ese chunk) */
  private placeMarker(selected: number | null): void {
    const s = selected !== null ? this.shown.get(selected) : undefined;
    // Dentro de la madriguera también se marca (en la entrada), para saber dónde está
    if (!s || !s.parent || (!s.sprite.visible && !s.hidden)) {
      this.marker.visible = false;
      return;
    }
    if (this.marker.parent !== s.parent) s.parent.addChild(this.marker);
    this.marker.visible = true;
    this.marker.position.set(Math.round(s.x), Math.round(s.y));
    this.marker.zIndex = s.y + 0.04;
    const bob = Math.round(Math.abs(Math.sin(this.clock / 260)) * 2);
    this.arrow.position.set(0, -(s.hidden ? 6 : SPECIES_ART[s.species].arrow[s.kind] + Math.round(s.lift)) - bob);
    this.arrow.zIndex = 1;
  }
}
