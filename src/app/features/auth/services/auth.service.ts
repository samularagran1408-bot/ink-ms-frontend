import { Injectable } from '@angular/core';
import { RegisterRequest } from '../models/register-request';
import { AuthResponse } from '../models/auth-response';
import { LoginRequest } from '../models/login-request';
import { LoginResponse } from '../models/login-response';
import { ForgotPasswordRequest } from '../models/forgot-password-request';
import { ForgotPasswordResponse } from '../models/forgot-password-response';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { API_BASE_URL } from '../../../core/config/api.config';
import { UsersService } from '../../../core/services/users.service';
import { SessionService } from '../../../core/services/session.service';

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
   * Auth ya materializa el perfil en users-ms.
   * Aquí solo registramos y luego actualizamos campos extra (teléfono / discapacidad).
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    const disabilityType = this.toCanonicalDisability(data.disabilityType);

    const authPayload: Record<string, string> = {
      nombre: data.fullName,
      email: data.email,
      password: data.password
    };

    // MOTRIZ exige acompañante en auth; si no lo tenemos, no lo enviamos en el alta.
    if (disabilityType && disabilityType !== 'MOTRIZ') {
      authPayload['disabilityType'] = disabilityType;
    }

    return this.http.post<AuthResponse>(`${this.apiUrlAuth}/register`, authPayload).pipe(
      switchMap((authResponse) => {
        this.session.setSession(authResponse.token);

        return this.usersService
          .updateProfile({
            fullName: data.fullName,
            phone: data.phone,
            disability: disabilityType || undefined
          })
          .pipe(
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
