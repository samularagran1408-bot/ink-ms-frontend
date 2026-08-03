import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { AppRole, ROLE_HOME, ROLE_LABELS, normalizeRoles, resolvePrimaryRole } from '../models/app-role';
import { UserProfile } from '../models/user-profile';
import { decodeJwtPayload, isTokenExpired } from '../utils/jwt.util';
import { UsersService } from './users.service';
import { LanguageService } from './language.service';

const TOKEN_KEY = 'auth_token';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);
  private readonly rolesSubject = new BehaviorSubject<AppRole[]>([]);

  readonly profile$ = this.profileSubject.asObservable();
  readonly roles$ = this.rolesSubject.asObservable();

  constructor(
    private usersService: UsersService,
    private router: Router,
    private injector: Injector
  ) {
    const token = this.getToken();
    if (token && !isTokenExpired(token)) {
      this.hydrateRolesFromToken(token);
    } else if (token) {
      this.clearSession();
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !isTokenExpired(token);
  }

  getRoles(): AppRole[] {
    return this.rolesSubject.value;
  }

  getPrimaryRole(): AppRole {
    return resolvePrimaryRole(this.getRoles());
  }

  getProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  getDisplayName(): string {
    return this.profileSubject.value?.fullName
      || decodeJwtPayload(this.getToken() || '')?.sub
      || 'Usuario';
  }

  getRoleLabel(): string {
    return ROLE_LABELS[this.getPrimaryRole()];
  }

  hasRole(...roles: AppRole[]): boolean {
    const current = this.getRoles();
    return roles.some((role) => current.includes(role));
  }

  setSession(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.hydrateRolesFromToken(token);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.profileSubject.next(null);
    this.rolesSubject.next([]);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/']);
  }

  homeForCurrentUser(): string {
    return ROLE_HOME[this.getPrimaryRole()];
  }

  loadProfile(): Observable<UserProfile | null> {
    if (!this.isAuthenticated()) {
      return of(null);
    }

    return this.usersService.getProfile().pipe(
      tap((profile) => {
        this.profileSubject.next(profile);
        if (profile.roles?.length) {
          this.rolesSubject.next(normalizeRoles(profile.roles));
        }
      }),
      catchError(() => {
        const token = this.getToken();
        if (token) {
          this.hydrateRolesFromToken(token);
        }
        return of(null);
      })
    );
  }

  bootstrapAfterLogin(token: string): Observable<string> {
    this.setSession(token);
    const languageService = this.injector.get(LanguageService);
    return this.loadProfile().pipe(
      switchMap(() => languageService.init()),
      map(() => this.homeForCurrentUser())
    );
  }

  private hydrateRolesFromToken(token: string): void {
    const payload = decodeJwtPayload(token);
    const roles = normalizeRoles(payload?.roles);
    this.rolesSubject.next(roles);
  }
}
