import { Component, OnDestroy } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ForgotPasswordRequest } from '../../models/forgot-password-request';

type RecoveryStep = 'email' | 'code' | 'password' | 'done';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnDestroy {
  step: RecoveryStep = 'email';
  forgotForm: FormGroup;
  codeForm: FormGroup;
  passwordForm: FormGroup;

  errorMessage: string | null = null;
  successMessage: string | null = null;
  isSubmitting = false;
  recoveryEmail = '';
  resendSeconds = 0;
  showPassword = false;
  showConfirmPassword = false;

  private resendTimer: ReturnType<typeof setInterval> | null = null;

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

    this.codeForm = this.fb.group({
      digits: this.fb.array(
        Array.from({ length: 6 }, () => this.fb.control('', [
          Validators.required,
          Validators.pattern(/^\d$/)
        ]))
      )
    });

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: ForgotPasswordComponent.passwordsMatch });

    const prefilledEmail = this.route.snapshot.queryParamMap.get('email');
    if (prefilledEmail) {
      this.forgotForm.patchValue({ email: prefilledEmail });
    }
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  get digits(): FormArray {
    return this.codeForm.get('digits') as FormArray;
  }

  get codeValue(): string {
    return this.digits.controls.map((control) => String(control.value || '')).join('');
  }

  get heroDesc(): string {
    if (this.step === 'code') {
      return `Enviamos un código de verificación a ${this.recoveryEmail}. Introdúcelo para continuar.`;
    }
    if (this.step === 'password') {
      return 'Crea una contraseña de al menos 6 caracteres para volver a entrar a tu cuenta.';
    }
    if (this.step === 'done') {
      return 'Ya puedes iniciar sesión con tu nueva contraseña.';
    }
    return 'Ingresa tu correo electrónico y te enviaremos un código de 6 dígitos para restablecer tu contraseña.';
  }

  goBack(): void {
    if (this.step === 'code') {
      this.step = 'email';
      this.errorMessage = null;
      return;
    }
    if (this.step === 'password') {
      this.step = 'code';
      this.errorMessage = null;
      return;
    }
    this.location.back();
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  fieldInvalid(form: FormGroup, fieldName: string): boolean {
    const control = form.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').replace(/\D/g, '').slice(-1);
    this.digits.at(index).setValue(value);
    input.value = value;
    if (value && index < 5) {
      this.focusDigit(index + 1);
    }
  }

  onDigitKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.digits.at(index - 1).setValue('');
      this.focusDigit(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      this.focusDigit(index - 1);
    }
    if (event.key === 'ArrowRight' && index < 5) {
      this.focusDigit(index + 1);
    }
  }

  onDigitPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) {
      return;
    }
    pasted.split('').forEach((digit, index) => this.digits.at(index).setValue(digit));
    this.focusDigit(Math.min(pasted.length, 5));
  }

  onSubmitEmail(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = this.forgotForm.value as ForgotPasswordRequest;
    this.authService.forgotPassword(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.recoveryEmail = payload.email;
        this.resetCodeInputs();
        this.step = 'code';
        this.successMessage = response.message
          || 'Si el correo existe, te enviamos un código de 6 dígitos.';
        this.startResendCooldown();
        setTimeout(() => this.focusDigit(0), 50);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.';
      }
    });
  }

  onSubmitCode(): void {
    this.errorMessage = null;
    this.successMessage = null;
    this.digits.markAllAsTouched();
    if (this.codeValue.length !== 6 || this.codeForm.invalid) {
      this.errorMessage = 'Ingresa el código de 6 dígitos que recibiste por correo.';
      return;
    }

    this.isSubmitting = true;
    this.authService.verifyResetCode(this.codeValue).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = null;
        this.step = 'password';
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'Código inválido o expirado. Revisa el correo o solicita uno nuevo.';
      }
    });
  }

  onSubmitPassword(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.authService.resetPassword({
      token: this.codeValue,
      newPassword: this.passwordForm.value.newPassword
    }).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.step = 'done';
        this.successMessage = response.message || 'Contraseña actualizada exitosamente.';
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'Código inválido o expirado. Solicita uno nuevo.';
        if (String(this.errorMessage).toLowerCase().includes('código')) {
          this.step = 'code';
        }
      }
    });
  }

  resendCode(): void {
    if (this.resendSeconds > 0 || !this.recoveryEmail || this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = null;
    this.authService.forgotPassword({ email: this.recoveryEmail }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetCodeInputs();
        this.successMessage = 'Enviamos un código nuevo a tu correo.';
        this.startResendCooldown();
        setTimeout(() => this.focusDigit(0), 50);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error?.error?.message || 'No se pudo reenviar el código.';
      }
    });
  }

  private focusDigit(index: number): void {
    if (typeof document === 'undefined') {
      return;
    }
    const input = document.getElementById(`otp-digit-${index}`) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }

  private resetCodeInputs(): void {
    this.digits.controls.forEach((control) => control.reset(''));
  }

  private startResendCooldown(seconds = 60): void {
    this.clearResendTimer();
    this.resendSeconds = seconds;
    this.resendTimer = setInterval(() => {
      this.resendSeconds -= 1;
      if (this.resendSeconds <= 0) {
        this.clearResendTimer();
      }
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  }
}
