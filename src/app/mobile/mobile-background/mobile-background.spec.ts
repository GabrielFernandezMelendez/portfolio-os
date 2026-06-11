import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileBackground } from './mobile-background';

describe('MobileBackground', () => {
  let component: MobileBackground;
  let fixture: ComponentFixture<MobileBackground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileBackground],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileBackground);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
