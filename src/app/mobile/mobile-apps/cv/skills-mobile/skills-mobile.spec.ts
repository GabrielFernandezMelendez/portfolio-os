import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsMobile } from './skills-mobile';

describe('SkillsMobile', () => {
  let component: SkillsMobile;
  let fixture: ComponentFixture<SkillsMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkillsMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(SkillsMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
