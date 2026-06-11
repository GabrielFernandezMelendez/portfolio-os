import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileRecentsComponent } from './mobile-recents';

describe('MobileRecentsComponent', () => {
  let component: MobileRecentsComponent;
  let fixture: ComponentFixture<MobileRecentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileRecentsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileRecentsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});