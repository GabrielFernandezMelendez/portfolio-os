import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubMobileComponent } from './github-mobile';

describe('GithubMobileComponent', () => {
  let component: GithubMobileComponent;
  let fixture: ComponentFixture<GithubMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GithubMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
