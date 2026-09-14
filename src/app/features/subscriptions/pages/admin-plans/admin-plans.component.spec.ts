import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AdminPlansComponent } from './admin-plans.component';

describe('AdminPlansComponent', () => {
  let component: AdminPlansComponent;
  let fixture: ComponentFixture<AdminPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AdminPlansComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
