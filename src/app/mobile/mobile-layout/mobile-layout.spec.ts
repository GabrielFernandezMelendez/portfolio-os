import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileLayoutComponent } from './mobile-layout';

describe('MobileLayoutComponent', () => {
  let component: MobileLayoutComponent;
  let fixture: ComponentFixture<MobileLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileLayoutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no abre las notificaciones mientras se juega (sí fuera del juego y en el resto de apps)', () => {
    component.openApp({ id: 'sandworld', title: 'Sandworld', icon: '🏝️' });
    component.openNotifications();
    expect(component.mobileView()).toBe('app');

    component.openApp({ id: 'about', title: 'Sobre mí', icon: '👤' });
    component.openNotifications();
    expect(component.mobileView()).toBe('notifications');
    component.closeNotifications();

    component.mobileView.set('home');
    component.openNotifications();
    expect(component.mobileView()).toBe('notifications');
  });
});
