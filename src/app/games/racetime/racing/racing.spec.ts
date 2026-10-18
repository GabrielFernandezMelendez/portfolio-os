import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Racing } from './racing';

describe('Racing', () => {
  let component: Racing;
  let fixture: ComponentFixture<Racing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Racing],
    }).compileComponents();

    fixture = TestBed.createComponent(Racing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
