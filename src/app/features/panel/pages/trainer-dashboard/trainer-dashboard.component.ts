import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { Disability, Routine } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { ReportsService } from '../../../../core/services/reports.service';

@Component({
  selector: 'app-trainer-dashboard',
  templateUrl: './trainer-dashboard.component.html',
  styleUrl: './trainer-dashboard.component.scss'
})
export class TrainerDashboardComponent implements OnInit {
  loading = true;
  routines: Routine[] = [];
  disabilities: Disability[] = [];
  athleteCount = 0;
  errorMessage: string | null = null;
  quizPassed = false;

  constructor(
    private session: SessionService,
    private reportsService: ReportsService,
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

    bootstrap$.subscribe((profile) => {
      this.quizPassed = !!profile?.trainerQuizPassed;
      this.reportsService.getTrainerPanel(profile?.id).subscribe({
        next: (panel) => {
          this.routines = panel.routines || [];
          this.disabilities = panel.disabilities || [];
          this.athleteCount = panel.athleteCount ?? panel.metrics?.['athletes'] ?? 0;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el panel del entrenador.';
          this.loading = false;
        }
      });
    });
  }

  get publishedCount(): number {
    return this.routines.filter((routine) => routine.status === 'published').length;
  }

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
}
