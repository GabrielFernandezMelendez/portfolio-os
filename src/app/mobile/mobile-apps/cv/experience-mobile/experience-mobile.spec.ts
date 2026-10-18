import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExperienceMobileComponent } from './experience-mobile';

describe('ExperienceMobileComponent', () => {
  let component: ExperienceMobileComponent;
  let fixture: ComponentFixture<ExperienceMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
