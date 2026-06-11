import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileHome } from './mobile-home';

describe('MobileHome', () => {
  let component: MobileHome;
  let fixture: ComponentFixture<MobileHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileHome],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
