import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileLayoutComponent } from './mobile-layout';

describe('MobileLayoutComponent', () => {
  let component: MobileLayoutComponent;
  let fixture: ComponentFixture<MobileLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileLayoutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});