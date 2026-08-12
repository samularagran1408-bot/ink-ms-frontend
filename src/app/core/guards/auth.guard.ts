import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { SessionService } from '../services/session.service';
import { isSafeReturnUrl } from '../utils/qr-attendance.util';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (this.session.isAuthenticated()) {
      return true;
    }
    const returnUrl = state.url;
    return this.router.createUrlTree(['/login'], {
      queryParams: isSafeReturnUrl(returnUrl) ? { returnUrl } : undefined
    });
  }
}
