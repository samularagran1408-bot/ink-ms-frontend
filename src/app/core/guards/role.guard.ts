import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { AppRole } from '../models/app-role';
import { SessionService } from '../services/session.service';
import { isSafeReturnUrl } from '../utils/qr-attendance.util';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (!this.session.isAuthenticated()) {
      const returnUrl = state.url;
      return this.router.createUrlTree(['/login'], {
        queryParams: isSafeReturnUrl(returnUrl) ? { returnUrl } : undefined
      });
    }

    const allowed = (route.data['roles'] as AppRole[] | undefined) ?? [];
    if (!allowed.length || this.session.hasRole(...allowed)) {
      return true;
    }

    return this.router.createUrlTree([this.session.homeForCurrentUser()]);
  }
}
