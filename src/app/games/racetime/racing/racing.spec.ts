import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RacingComponent } from './racing';

describe('RacingComponent', () => {
  let component: RacingComponent;
  let fixture: ComponentFixture<RacingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RacingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RacingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
