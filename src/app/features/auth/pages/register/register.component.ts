import { Component, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { disabilityRequiresCompanion, RegisterRequest } from '../../models/register-request';
import { DisabilityType } from '../../models/disability-type';
import { AccessibilityService } from '../../../../core/services/accessibility.service';
import { SessionService } from '../../../../core/services/session.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnDestroy {
  registerForm: FormGroup;

  showPassword = false;
  showConfirmPassword = false;
  errorMessage: string | null = null;
  isSubmitting = false;
  registrationComplete = false;
  registeredEmail = '';
  showCompanionFields = false;

  readonly disabilityOptions: { value: DisabilityType; label: string }[] = [
    { value: 'visual', label: 'Discapacidad Visual' },
    { value: 'motriz', label: 'Discapacidad Motriz' },
    { value: 'auditiva', label: 'Discapacidad Auditiva' },
    { value: 'intelectual', label: 'Discapacidad Intelectual' },
    { value: 'otra', label: 'Otra / Ninguna' },
  ];

  private disabilitySub?: Subscription;

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
      companion: this.fb.group({
        fullName: [''],
        phone: [''],
        relationship: [''],
        email: ['', Validators.email],
      }),
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
    }, { validators: this.passwordsMatchValidator });

    this.disabilitySub = this.registerForm.get('disabilityType')!.valueChanges.subscribe((value) => {
      this.applyCompanionValidators(value);
    });
  }

  ngOnDestroy(): void {
    this.disabilitySub?.unsubscribe();
  }

  get companionGroup(): FormGroup {
    return this.registerForm.get('companion') as FormGroup;
  }

  private applyCompanionValidators(disabilityType: string): void {
    this.showCompanionFields = disabilityRequiresCompanion(disabilityType);
    const fullName = this.companionGroup.get('fullName')!;
    const phone = this.companionGroup.get('phone')!;

    if (this.showCompanionFields) {
      fullName.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(150)]);
      phone.setValidators([
        Validators.required,
        Validators.minLength(7),
        Validators.maxLength(20),
        Validators.pattern(/^[+]?[0-9\s()-]{7,20}$/)
      ]);
    } else {
      fullName.clearValidators();
      phone.clearValidators();
      this.companionGroup.reset({ fullName: '', phone: '', relationship: '', email: '' });
    }

    fullName.updateValueAndValidity({ emitEvent: false });
    phone.updateValueAndValidity({ emitEvent: false });
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

  companionFieldInvalid(fieldName: string): boolean {
    const control = this.companionGroup.get(fieldName);
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

    const raw = this.registerForm.getRawValue();
    const payload: RegisterRequest = {
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      disabilityType: raw.disabilityType,
      password: raw.password,
      confirmPassword: raw.confirmPassword,
      acceptTerms: raw.acceptTerms,
    };

    if (disabilityRequiresCompanion(raw.disabilityType)) {
      payload.companion = {
        fullName: raw.companion.fullName,
        phone: raw.companion.phone,
        relationship: raw.companion.relationship || undefined,
        email: raw.companion.email || undefined,
      };
    }

    this.authService.register(payload).subscribe({
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
        this.errorMessage = this.extractErrorMessage(error)
          || 'Ocurrió un error al registrar. Intenta de nuevo.';
      }
    });
  }

  private extractErrorMessage(error: unknown): string | null {
    const err = error as { error?: { message?: string; errors?: Record<string, string> | string[] } };
    if (err?.error?.message) {
      return err.error.message;
    }
    const errors = err?.error?.errors;
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      const first = Object.values(errors)[0];
      return typeof first === 'string' ? first : null;
    }
    if (Array.isArray(errors) && errors.length > 0) {
      return String(errors[0]);
    }
    return null;
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
