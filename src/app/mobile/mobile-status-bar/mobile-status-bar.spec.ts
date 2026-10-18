import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileStatusBarComponent } from './mobile-status-bar';

describe('MobileStatusBarComponent', () => {
  let component: MobileStatusBarComponent;
  let fixture: ComponentFixture<MobileStatusBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileStatusBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileStatusBarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
