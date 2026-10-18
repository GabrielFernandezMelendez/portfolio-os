import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EducationMobileComponent } from './education-mobile';

describe('EducationMobileComponent', () => {
  let component: EducationMobileComponent;
  let fixture: ComponentFixture<EducationMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EducationMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EducationMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
