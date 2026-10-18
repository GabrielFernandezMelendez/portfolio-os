import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsMobileComponent } from './settings-mobile';

describe('SettingsMobileComponent', () => {
  let component: SettingsMobileComponent;
  let fixture: ComponentFixture<SettingsMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
