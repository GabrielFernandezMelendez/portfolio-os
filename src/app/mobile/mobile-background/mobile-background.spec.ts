import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileBackgroundComponent } from './mobile-background';

describe('MobileBackgroundComponent', () => {
  let component: MobileBackgroundComponent;
  let fixture: ComponentFixture<MobileBackgroundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileBackgroundComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileBackgroundComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
