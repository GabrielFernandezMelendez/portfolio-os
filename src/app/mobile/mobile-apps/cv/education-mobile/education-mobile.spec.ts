import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EducationMobile } from './education-mobile';

describe('EducationMobile', () => {
  let component: EducationMobile;
  let fixture: ComponentFixture<EducationMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EducationMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(EducationMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
