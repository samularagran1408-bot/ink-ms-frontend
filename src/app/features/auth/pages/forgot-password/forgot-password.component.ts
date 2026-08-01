import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ForgotPasswordRequest } from '../../models/forgot-password-request';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;

  errorMessage: string | null = null;
  successMessage: string | null = null;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    const prefilledEmail = this.route.snapshot.queryParamMap.get('email');
    if (prefilledEmail) {
      this.forgotForm.patchValue({ email: prefilledEmail });
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  fieldInvalid(fieldName: string): boolean {
    const control = this.forgotForm.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService.forgotPassword(this.forgotForm.value as ForgotPasswordRequest).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = response.message || 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.';
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.';
      }
    });
  }
}
