import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';

import { AppRole } from '../models/app-role';
import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.session.isAuthenticated()) {
      return this.router.createUrlTree(['/login']);
    }

    const allowed = (route.data['roles'] as AppRole[] | undefined) ?? [];
    if (!allowed.length || this.session.hasRole(...allowed)) {
      return true;
    }

    return this.router.createUrlTree([this.session.homeForCurrentUser()]);
  }
}
