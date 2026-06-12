import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExperienceMobile } from './experience-mobile';

describe('ExperienceMobile', () => {
  let component: ExperienceMobile;
  let fixture: ComponentFixture<ExperienceMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
