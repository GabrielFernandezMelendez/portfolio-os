import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutMobileComponent } from './about-mobile';

describe('AboutMobileComponent', () => {
  let component: AboutMobileComponent;
  let fixture: ComponentFixture<AboutMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
