import { Injectable } from '@angular/core';
import { RegisterRequest } from '../models/register-request';
import { AuthResponse } from '../models/auth-response';
import { LoginRequest } from '../models/login-request';
import { LoginResponse } from '../models/login-response';
import { ForgotPasswordRequest } from '../models/forgot-password-request';
import { ForgotPasswordResponse } from '../models/forgot-password-response';
import { ResetPasswordRequest } from '../models/reset-password-request';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { API_BASE_URL } from '../../../core/config/api.config';
import { UsersService } from '../../../core/services/users.service';
import { SessionService } from '../../../core/services/session.service';
import { UpdateProfileRequest } from '../../../core/models/user-profile';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrlAuth = `${API_BASE_URL}/api/auth`;

  constructor(
    private http: HttpClient,
    private usersService: UsersService,
    private session: SessionService
  ) {}

  /**
   * Auth materializa el perfil (discapacidad + acompañante) en users-ms.
   * Luego se actualizan campos extra del perfil (teléfono).
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    const disabilityType = this.toCanonicalDisability(data.disabilityType);

    const authPayload: Record<string, unknown> = {
      nombre: data.fullName,
      email: data.email,
      password: data.password
    };

    if (disabilityType) {
      authPayload['disabilityType'] = disabilityType;
    }

    if (data.companion?.fullName && data.companion?.phone) {
      authPayload['companion'] = {
        fullName: data.companion.fullName.trim(),
        phone: data.companion.phone.trim(),
        relationship: data.companion.relationship?.trim() || undefined,
        email: data.companion.email?.trim() || undefined
      };
    }

    return this.http.post<AuthResponse>(`${this.apiUrlAuth}/register`, authPayload).pipe(
      switchMap((authResponse) => {
        this.session.setSession(authResponse.token);

        const profileUpdate: UpdateProfileRequest = {
          fullName: data.fullName,
          phone: data.phone,
          disability: disabilityType || undefined,
          companionFullName: data.companion?.fullName?.trim() || undefined,
          companionPhone: data.companion?.phone?.trim() || undefined,
          companionRelationship: data.companion?.relationship?.trim() || undefined,
          companionEmail: data.companion?.email?.trim() || undefined
        };

        return this.usersService.updateProfile(profileUpdate).pipe(
          catchError(() => of(null)),
          map(() => authResponse)
        );
      })
    );
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrlAuth}/login`, data);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrlAuth}/forgot-password`, data);
  }

  verifyResetCode(token: string): Observable<{ valid: boolean; message: string }> {
    return this.http.post<{ valid: boolean; message: string }>(`${this.apiUrlAuth}/verify-reset-code`, { token });
  }

  resetPassword(data: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrlAuth}/reset-password`, data);
  }

  logoutRemote(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrlAuth}/logout`, {});
  }

  private toCanonicalDisability(value?: string): string | null {
    if (!value || value === 'otra') {
      return null;
    }

    const map: Record<string, string> = {
      visual: 'VISUAL',
      motriz: 'MOTRIZ',
      auditiva: 'AUDITIVA',
      intelectual: 'INTELECTUAL'
    };

    return map[value] || null;
  }
}
