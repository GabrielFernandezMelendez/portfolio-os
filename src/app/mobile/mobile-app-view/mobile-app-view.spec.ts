import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileAppViewComponent } from './mobile-app-view';

describe('MobileAppViewComponent', () => {
  let component: MobileAppViewComponent;
  let fixture: ComponentFixture<MobileAppViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileAppViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileAppViewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
