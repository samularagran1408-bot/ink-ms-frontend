import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganizerPlansComponent } from './organizer-plans.component';

describe('OrganizerPlansComponent', () => {
  let component: OrganizerPlansComponent;
  let fixture: ComponentFixture<OrganizerPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrganizerPlansComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OrganizerPlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
