import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Disability, Routine, RoutineRegistration } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

@Component({
  selector: 'app-trainer-dashboard',
  templateUrl: './trainer-dashboard.component.html',
  styleUrl: './trainer-dashboard.component.scss'
})
export class TrainerDashboardComponent implements OnInit {
  loading = true;
  routines: Routine[] = [];
  disabilities: Disability[] = [];
  athleteIds = new Set<string>();
  errorMessage: string | null = null;
  quizPassed = false;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    const bootstrap$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    bootstrap$.pipe(
      switchMap((profile) => {
        this.quizPassed = !!profile?.trainerQuizPassed;
        const trainerId = profile?.id || '';
        return forkJoin({
          routines: trainerId
            ? this.sportsService.getRoutinesByTrainer(trainerId).pipe(catchError(() => of([] as Routine[])))
            : of([] as Routine[]),
          disabilities: this.sportsService.getActiveDisabilities().pipe(catchError(() => of([] as Disability[])))
        });
      })
    ).subscribe({
      next: ({ routines, disabilities }) => {
        this.routines = routines;
        this.disabilities = disabilities;
        this.loadAthleteIds(routines);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el panel del entrenador.';
        this.loading = false;
      }
    });
  }

  get publishedCount(): number {
    return this.routines.filter((routine) => routine.status === 'published').length;
  }

  /**
   * Navega a la pantalla de quiz de aptitud del entrenador.
   */
  goQuiz(): void {
    this.router.navigate(['/trainer/quiz']);
  }

  goSessions(): void {
    this.router.navigate(['/trainer/sessions']);
  }

  goSports(): void {
    this.router.navigate(['/trainer/sports']);
  }

  goDisabilities(): void {
    this.router.navigate(['/trainer/disabilities']);
  }

  goAssociations(): void {
    this.router.navigate(['/trainer/associations']);
  }

  private loadAthleteIds(routines: Routine[]): void {
    if (!routines.length) {
      this.athleteIds = new Set();
      return;
    }

    forkJoin(
      routines.map((routine) =>
        this.sportsService.getRoutineRegistrations(routine.id).pipe(catchError(() => of([] as RoutineRegistration[])))
      )
    ).subscribe((groups) => {
      const ids = new Set<string>();
      groups.flat().forEach((reg) => ids.add(reg.userId));
      this.athleteIds = ids;
    });
  }
}
