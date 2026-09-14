import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { OrganizerPlansComponent } from './organizer-plans.component';

describe('OrganizerPlansComponent', () => {
  let component: OrganizerPlansComponent;
  let fixture: ComponentFixture<OrganizerPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerPlansComponent, HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizerPlansComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
