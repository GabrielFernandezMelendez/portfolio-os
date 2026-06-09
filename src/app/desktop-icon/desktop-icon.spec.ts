import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesktopIcon } from './desktop-icon';

describe('DesktopIcon', () => {
  let component: DesktopIcon;
  let fixture: ComponentFixture<DesktopIcon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopIcon],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopIcon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
