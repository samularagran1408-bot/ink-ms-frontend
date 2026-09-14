import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { EventPaymentSetupComponent } from './event-payment-setup.component';

describe('EventPaymentSetupComponent', () => {
  let component: EventPaymentSetupComponent;
  let fixture: ComponentFixture<EventPaymentSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, EventPaymentSetupComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EventPaymentSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
