import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    if (this.session.isAuthenticated()) {
      return true;
    }
    return this.router.createUrlTree(['/login']);
  }
}
