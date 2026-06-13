import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsMobile } from './settings-mobile';

describe('SettingsMobile', () => {
  let component: SettingsMobile;
  let fixture: ComponentFixture<SettingsMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
