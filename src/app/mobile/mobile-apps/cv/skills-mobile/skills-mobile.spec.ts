import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsMobileComponent } from './skills-mobile';

describe('SkillsMobileComponent', () => {
  let component: SkillsMobileComponent;
  let fixture: ComponentFixture<SkillsMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkillsMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SkillsMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
