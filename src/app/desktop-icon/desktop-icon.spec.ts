import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesktopIconComponent } from './desktop-icon';
import { OsWindow } from '../interfaces/window.interface';

// Ventana de prueba con todos los campos obligatorios de OsWindow
const MOCK_WINDOW: OsWindow = {
  id: 'about',
  title: 'Sobre mí',
  icon: '👤',
  filename: 'about.exe',
  isOpen: false,
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

describe('DesktopIconComponent', () => {
  let component: DesktopIconComponent;
  let fixture: ComponentFixture<DesktopIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopIconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('win', MOCK_WINDOW);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});