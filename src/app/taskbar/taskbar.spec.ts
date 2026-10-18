import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskbarComponent } from './taskbar';
import { OsWindow } from '../interfaces/window.interface';

// Una ventana abierta y otra minimizada para que la barra tenga algo que pintar
const MOCK_WINDOWS: OsWindow[] = [
  {
    id: 'about', title: 'Sobre mí', icon: '👤', filename: 'about.exe',
    isOpen: true, isMinimized: false, x: 100, y: 80, zIndex: 2,
    width: 480, height: 360, onDesktop: true, desktopX: 20, desktopY: 20,
  },
  {
    id: 'skills', title: 'Habilidades', icon: '🛠', filename: 'skills.exe',
    isOpen: true, isMinimized: true, x: 140, y: 120, zIndex: 1,
    width: 480, height: 360, onDesktop: true, desktopX: 20, desktopY: 100,
  },
];

describe('TaskbarComponent', () => {
  let component: TaskbarComponent;
  let fixture: ComponentFixture<TaskbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskbarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('windows', MOCK_WINDOWS);
    fixture.componentRef.setInput('isDark', true);
    fixture.componentRef.setInput('golRunning', true);
    fixture.componentRef.setInput('golSpeed', 1);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});