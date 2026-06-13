import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubMobile } from './github-mobile';

describe('GithubMobile', () => {
  let component: GithubMobile;
  let fixture: ComponentFixture<GithubMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(GithubMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
