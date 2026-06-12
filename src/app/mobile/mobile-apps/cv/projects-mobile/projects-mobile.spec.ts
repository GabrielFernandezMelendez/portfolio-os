import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsMobile } from './projects-mobile';

describe('ProjectsMobile', () => {
  let component: ProjectsMobile;
  let fixture: ComponentFixture<ProjectsMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
