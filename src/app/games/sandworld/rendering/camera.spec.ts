import { Camera, ZOOM_LEVELS } from './camera';

describe('Camera', () => {
  const bounds = { x: -160, y: -60, w: 320, h: 228 };

  function make(w = 900, h = 700): Camera {
    const cam = new Camera();
    cam.setViewport(w, h);
    cam.setBounds(bounds);
    cam.fit();
    return cam;
  }

  /** Deja terminar la animación de zoom */
  const settle = (cam: Camera): void => {
    for (let i = 0; i < 100; i++) cam.update(16);
  };

  it('encaja el mundo a lo ancho con un nivel fijo y lo centra', () => {
    const cam = make(900, 700);
    expect(cam.scale).toBe(2);                       // 2.5 no es un nivel: se queda en ×2
    expect(cam.cx).toBe(0);
    const phone = make(390, 844);
    expect(phone.scale).toBe(1);
  });

  it('screenToWorld es la inversa del desplazamiento aplicado', () => {
    const cam = make();
    const w = cam.screenToWorld(450, 350);
    expect(w.x * cam.scale + cam.offsetX).toBeCloseTo(450, 5);
    expect(w.y * cam.scale + cam.offsetY).toBeCloseTo(350, 5);
  });

  it('el zoom mantiene fijo el punto del mundo bajo el cursor', () => {
    const cam = make();
    const before = cam.screenToWorld(600, 300);
    cam.zoomStep(1, 600, 300);
    settle(cam);
    expect(cam.scale).toBe(ZOOM_LEVELS[3]);
    const after = cam.screenToWorld(600, 300);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  it('no pasa del nivel mínimo ni del máximo', () => {
    const cam = make(390, 844);
    cam.zoomStep(-1, 0, 0);
    settle(cam);
    expect(cam.scale).toBe(ZOOM_LEVELS[0]);
    for (let i = 0; i < 10; i++) cam.zoomStep(1, 195, 422);
    settle(cam);
    expect(cam.scale).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
  });

  it('el centro no sale de los límites del mundo', () => {
    const cam = make();
    cam.panBy(-100_000, 100_000);
    expect(cam.cx).toBe(bounds.x + bounds.w);
    expect(cam.cy).toBe(bounds.y);
  });

  it('la inercia sigue moviendo la cámara y se frena sola', () => {
    const cam = make();
    cam.zoomStep(1, 450, 350);
    settle(cam);
    const x0 = cam.cx;
    cam.fling(-1, 0);                                 // dedo hacia la izquierda → la cámara va a la derecha
    cam.update(16);
    expect(cam.cx).toBeGreaterThan(x0);
    for (let i = 0; i < 400; i++) cam.update(16);
    const stopped = cam.cx;
    cam.update(16);
    expect(cam.cx).toBe(stopped);
  });
});
