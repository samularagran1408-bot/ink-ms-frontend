import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { SessionService } from '../services/session.service';

/**
 * Bloquea rutas de gestión de entrenador/organizador hasta aprobar el quiz.
 * ADMIN queda exento.
 */
@Injectable({
  providedIn: 'root'
})
export class QuizCompletedGuard implements CanActivate {
  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  /**
   * Permite la ruta si el quiz del rol está aprobado; si no, redirige a /quiz.
   */
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> | boolean | UrlTree {
    if (!this.session.isAuthenticated()) {
      return this.router.createUrlTree(['/login']);
    }
    if (this.session.hasRole('ADMIN')) {
      return true;
    }

    const quizRole = (route.data['quizRole'] as 'ENTRENADOR' | 'ORGANIZADOR' | undefined)
      || (this.session.hasRole('ENTRENADOR') ? 'ENTRENADOR' : 'ORGANIZADOR');

    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    return profile$.pipe(
      switchMap((profile) => {
        if (!profile) {
          return of(this.router.createUrlTree(['/login']));
        }
        const passed = quizRole === 'ENTRENADOR'
          ? !!profile.trainerQuizPassed
          : !!profile.organizerQuizPassed;
        if (passed) {
          return of(true);
        }
        const quizPath = quizRole === 'ENTRENADOR' ? '/trainer/quiz' : '/organizer/quiz';
        return of(this.router.createUrlTree([quizPath]));
      }),
      catchError(() => of(this.router.createUrlTree(['/login'])))
    );
  }
}
