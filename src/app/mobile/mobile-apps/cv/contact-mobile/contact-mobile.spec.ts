import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactMobileComponent } from './contact-mobile';

describe('ContactMobileComponent', () => {
  let component: ContactMobileComponent;
  let fixture: ComponentFixture<ContactMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactMobileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactMobileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
