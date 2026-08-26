import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { isSafeReturnUrl } from '../../../../core/utils/qr-attendance.util';

import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/login-request';
import { AccessibilityService } from '../../../../core/services/accessibility.service';
import { SessionService } from '../../../../core/services/session.service';
import { NotificationAnnounceService } from '../../../../core/services/notification-announce.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;

  showPassword = false;
  errorMessage: string | null = null;
  isSubmitting = false;
  loginSuccess = false;
  loginFailed = false;
  attemptedEmail = '';

  constructor(
    private fb: FormBuilder,
    private location: Location,
    private authService: AuthService,
    private session: SessionService,
    private route: ActivatedRoute,
    private router: Router,
    public accessibilityService: AccessibilityService,
    private notificationAnnounce: NotificationAnnounceService,
    private translate: TranslateService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  goBack(): void {
    this.location.back();
  }

  fieldInvalid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.loginSuccess = false;
    this.loginFailed = false;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService.login(this.loginForm.value as LoginRequest).subscribe({
      next: (response) => {
        this.session.bootstrapAfterLogin(response.token).subscribe({
          next: (home) => {
            this.isSubmitting = false;
            this.loginSuccess = true;
            this.notificationAnnounce.start();
            this.navigateAfterLogin(home);
          },
          error: () => {
            this.isSubmitting = false;
            this.loginSuccess = true;
            this.notificationAnnounce.start();
            this.navigateAfterLogin(this.session.homeForCurrentUser());
          }
        });
      },
      error: (error) => {
        this.isSubmitting = false;

        if (error?.status === 401) {
          this.attemptedEmail = this.loginForm.value.email;
          this.loginFailed = true;
        } else {
            this.errorMessage = error?.error?.message || this.translate.instant('AUTH.DENIED_DESC');
        }
      }
    });
  }

  retry(): void {
    this.loginFailed = false;
    this.loginForm.get('password')?.reset();
  }

  onNeedHelp(): void {
    alert('Contáctanos en soporte@inklusport.com');
  }

  private navigateAfterLogin(home: string): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (isSafeReturnUrl(returnUrl)) {
      void this.router.navigateByUrl(returnUrl as string);
      return;
    }
    void this.router.navigate([home]);
  }
}
