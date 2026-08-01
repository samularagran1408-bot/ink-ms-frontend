import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { AccessibilityService } from '../../../../core/services/accessibility.service';

@Component({
  selector: 'app-start-interface',
  templateUrl: './start-interface.component.html',
  styleUrl: './start-interface.component.scss'
})
export class StartInterfaceComponent {
  constructor(
    private router: Router,
    private location: Location,
    public accessibilityService: AccessibilityService
  ) {}

  goBack(): void {
    this.location.back();
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  goToGuest(): void {
    this.router.navigate(['/guest']);
  }
}