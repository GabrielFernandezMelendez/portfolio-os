import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileNavbar } from './mobile-navbar';

describe('MobileNavbar', () => {
  let component: MobileNavbar;
  let fixture: ComponentFixture<MobileNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileNavbar],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileNavbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
