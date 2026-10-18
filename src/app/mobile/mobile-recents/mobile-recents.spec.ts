import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileRecentsComponent } from './mobile-recents';
import { MobileApp } from '../mobile.interfaces';

// Dos apps abiertas para que la pantalla de recientes muestre tarjetas
const MOCK_OPENED_APPS: MobileApp[] = [
  { id: 'about',  title: 'Sobre mí', icon: '👤' },
  { id: 'racing', title: 'RaceTime', icon: '🏎️' },
];

describe('MobileRecentsComponent', () => {
  let component: MobileRecentsComponent;
  let fixture: ComponentFixture<MobileRecentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileRecentsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileRecentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('openedApps', MOCK_OPENED_APPS);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});