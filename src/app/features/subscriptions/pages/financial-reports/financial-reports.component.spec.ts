import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { FinancialReportsComponent } from './financial-reports.component';

describe('FinancialReportsComponent', () => {
  let component: FinancialReportsComponent;
  let fixture: ComponentFixture<FinancialReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule, FinancialReportsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
