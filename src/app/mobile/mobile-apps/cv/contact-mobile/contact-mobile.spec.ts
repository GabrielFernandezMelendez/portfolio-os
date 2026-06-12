import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactMobile } from './contact-mobile';

describe('ContactMobile', () => {
  let component: ContactMobile;
  let fixture: ComponentFixture<ContactMobile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactMobile],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactMobile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
