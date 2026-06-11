import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileAppView } from './mobile-app-view';

describe('MobileAppView', () => {
  let component: MobileAppView;
  let fixture: ComponentFixture<MobileAppView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileAppView],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileAppView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
