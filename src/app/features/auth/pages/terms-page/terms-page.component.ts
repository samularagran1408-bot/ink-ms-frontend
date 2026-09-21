import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-terms-page',
  templateUrl: './terms-page.component.html',
  styleUrl: './terms-page.component.scss'
})
export class TermsPageComponent {
  readonly currentYear = new Date().getFullYear();

  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
