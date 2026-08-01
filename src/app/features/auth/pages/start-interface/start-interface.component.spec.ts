import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartInterfaceComponent } from './start-interface.component';

describe('StartInterfaceComponent', () => {
  let component: StartInterfaceComponent;
  let fixture: ComponentFixture<StartInterfaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StartInterfaceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StartInterfaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
