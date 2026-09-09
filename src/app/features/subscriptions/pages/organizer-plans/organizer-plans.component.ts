import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-organizer-plans',
  templateUrl: './organizer-plans.component.html',
  styleUrl: './organizer-plans.component.scss'
})
export class OrganizerPlansComponent {

}
