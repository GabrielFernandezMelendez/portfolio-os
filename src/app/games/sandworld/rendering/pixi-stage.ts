import { Application, Container } from 'pixi.js';
import { SKY } from '../config/palette.config';

/**
 * Adaptador de PixiJS.
 * Es lo único del juego que crea y destruye la aplicación de Pixi.
 * El componente Angular no toca Pixi directamente: le pide a esta clase montar, pausar y destruir.
 */
export class PixiStage {
  private app: Application | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  /** Contenedor del mundo (terreno, fauna, partículas). La cámara mueve y escala este contenedor. */
  readonly world = new Container();

  /**
   * Crea la aplicación y la engancha al elemento host.
   * Devuelve null si el componente se destruyó mientras Pixi se inicializaba
   * (pasa si el usuario abre y cierra la app muy rápido).
   */
  async mount(
    host: HTMLElement,
    onResize?: (width: number, height: number) => void,
  ): Promise<Application | null> {
    const app = new Application();

    await app.init({
      background: SKY.day,
      antialias: false, // pixel art: sin suavizado
      roundPixels: true, // evita píxeles a medias al mover la cámara
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });

    // Si nos han destruido durante el await, limpiamos y salimos
    if (this.destroyed) {
      app.destroy(true, { children: true, texture: true });
      return null;
    }

    host.appendChild(app.canvas);
    this.world.sortableChildren = true;
    app.stage.addChild(this.world);

    // Se adapta al tamaño del frame de la app, no al de la ventana del navegador
    this.resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || !this.app) return;
      const w = Math.max(1, box.width),
        h = Math.max(1, box.height);
      this.app.renderer.resize(w, h);
      onResize?.(w, h); // la cámara se recoloca
    });
    this.resizeObserver.observe(host);

    this.app = app;
    return app;
  }

  get application(): Application | null {
    return this.app;
  }

  /** Detiene el bucle de render (pestaña oculta, ajustes abiertos...) */
  pause(): void {
    this.app?.ticker.stop();
  }

  resume(): void {
    this.app?.ticker.start();
  }

  /** Libera GPU, canvas y observadores. Seguro de llamar varias veces. */
  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
