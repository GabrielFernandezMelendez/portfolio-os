import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WindowComponent } from './window';
import { OsWindow } from '../interfaces/window.interface';

// Ventana de prueba con todos los campos obligatorios de OsWindow
const MOCK_WINDOW: OsWindow = {
  id: 'about',
  title: 'Sobre mí',
  icon: '👤',
  filename: 'about.exe',
  isOpen: true,
  isMinimized: false,
  x: 100,
  y: 80,
  zIndex: 1,
  width: 480,
  height: 360,
  onDesktop: true,
  desktopX: 20,
  desktopY: 20,
};

describe('WindowComponent', () => {
  let component: WindowComponent;
  let fixture: ComponentFixture<WindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WindowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WindowComponent);
    component = fixture.componentInstance;
    // Los input.required() necesitan valor antes del primer ciclo de detección de cambios
    fixture.componentRef.setInput('win', MOCK_WINDOW);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});