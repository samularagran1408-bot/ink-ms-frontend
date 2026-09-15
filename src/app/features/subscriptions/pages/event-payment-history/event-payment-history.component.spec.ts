import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { EventPaymentHistoryComponent } from './event-payment-history.component';

describe('EventPaymentHistoryComponent', () => {
  let component: EventPaymentHistoryComponent;
  let fixture: ComponentFixture<EventPaymentHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventPaymentHistoryComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(EventPaymentHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
