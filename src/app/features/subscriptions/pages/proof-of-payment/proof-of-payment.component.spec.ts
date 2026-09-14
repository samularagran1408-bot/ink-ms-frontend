import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';

import { ProofOfPaymentComponent } from './proof-of-payment.component';

describe('ProofOfPaymentComponent', () => {
  let component: ProofOfPaymentComponent;
  let fixture: ComponentFixture<ProofOfPaymentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProofOfPaymentComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProofOfPaymentComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
