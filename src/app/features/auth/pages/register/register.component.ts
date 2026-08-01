import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../models/register-request';
import { DisabilityType } from '../../models/disability-type';
import { AccessibilityService } from '../../../../core/services/accessibility.service';
import { SessionService } from '../../../../core/services/session.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  registerForm: FormGroup;

  showPassword = false;
  showConfirmPassword = false;
  errorMessage: string | null = null;
  isSubmitting = false;
  registrationComplete = false;
  registeredEmail = '';

  readonly disabilityOptions: { value: DisabilityType; label: string }[] = [
    { value: 'visual', label: 'Discapacidad Visual' },
    { value: 'motriz', label: 'Discapacidad Motriz' },
    { value: 'auditiva', label: 'Discapacidad Auditiva' },
    { value: 'intelectual', label: 'Discapacidad Intelectual' },
    { value: 'otra', label: 'Otra / Ninguna' },
  ];

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private authService: AuthService,
    private session: SessionService,
    private router: Router,
    public accessibilityService: AccessibilityService
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(20)]],
      disabilityType: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
    }, { validators: this.passwordsMatchValidator });
  }

  private passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  };

  goBack(): void {
    this.location.back();
  }

  fieldInvalid(fieldName: string): boolean {
    const control = this.registerForm.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  passwordsMismatch(): boolean {
    const confirmPassword = this.registerForm.get('confirmPassword');
    return this.registerForm.hasError('passwordsMismatch') && !!confirmPassword && (confirmPassword.touched || confirmPassword.dirty);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(): void {
    this.errorMessage = null;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService.register(this.registerForm.value as RegisterRequest).subscribe({
      next: (response) => {
        this.session.bootstrapAfterLogin(response.token).subscribe({
          next: () => {
            this.isSubmitting = false;
            this.registeredEmail = response.email;
            this.registrationComplete = true;
          },
          error: () => {
            this.isSubmitting = false;
            this.registeredEmail = response.email;
            this.registrationComplete = true;
          }
        });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'Ocurrió un error al registrar. Intenta de nuevo.';
      }
    });
  }

  continueToDashboard(): void {
    this.router.navigate([this.session.homeForCurrentUser()]);
  }

  onResendEmail(): void {
    alert(`Hemos reenviado el correo de bienvenida a ${this.registeredEmail}.`);
  }

  onNeedHelp(): void {
    alert('Contáctanos en soporte@inklusport.com');
  }
}
