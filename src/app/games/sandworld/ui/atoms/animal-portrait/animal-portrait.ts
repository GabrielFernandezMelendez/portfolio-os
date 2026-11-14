import { ChangeDetectionStrategy, Component, ElementRef, effect, input, viewChild } from '@angular/core';
import { animalCanvas, artKind } from '../../../rendering/fauna/fauna-sprites';

/** Rectángulo de los píxeles no transparentes de un canvas */
function contentBox(c: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!d[(y * c.width + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Retrato de un animal para su ficha: su propio sprite (quieto, de frente) sobre un fondo de hierba, en pixel art nítido.
 * Provisional: en la fase de pulido será un selfie con complementos (parche, cigarro, monóculo, tupé...).
 */
@Component({
  selector: 'sw-animal-portrait',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #c></canvas>`,
  styles: `
    :host { display: block; line-height: 0; border: 2px solid var(--sw-edge); background: #9fcf6a; box-shadow: inset 0 -6px 0 #7fb24e; }
    canvas { image-rendering: pixelated; display: block; }
  `,
})
export class AnimalPortraitComponent {
  /** Especie (clave del registro), si es cría y su sexo: de ahí sale qué dibujo toca */
  readonly species = input.required<string>();
  readonly young = input(false);
  readonly sex = input<'male' | 'female'>('female');
  readonly dead = input(false);
  /** Lado del retrato en px de pantalla */
  readonly size = input(64);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');

  constructor() {
    effect(() => {
      const c = this.canvas().nativeElement, size = this.size();
      // El tamaño se pone aquí (no con un binding): cambiarlo después de dibujar borraría el canvas
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const sprite = animalCanvas(this.species(), artKind(this.species(), this.young(), this.sex()), this.dead() ? 'dead' : 'idle', 0, false);
      // Solo lo dibujado (sin el aire del lienzo), a la mayor escala entera que quepa: píxeles nítidos
      const box = contentBox(sprite);
      const k = Math.max(1, Math.floor(Math.min((size - 6) / box.w, (size - 6) / box.h)));
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      const w = box.w * k, h = box.h * k;
      ctx.drawImage(sprite, box.x, box.y, box.w, box.h, Math.round((size - w) / 2), size - h - 3, w, h);
    });
  }
}
