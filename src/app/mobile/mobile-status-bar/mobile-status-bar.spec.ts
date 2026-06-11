import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileStatusBar } from './mobile-status-bar';

describe('MobileStatusBar', () => {
  let component: MobileStatusBar;
  let fixture: ComponentFixture<MobileStatusBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileStatusBar],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileStatusBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
