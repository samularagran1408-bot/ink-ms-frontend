import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { of, Subscription } from 'rxjs';

import { Disability, Routine } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-trainer-dashboard',
  templateUrl: './trainer-dashboard.component.html',
  styleUrl: './trainer-dashboard.component.scss'
})
export class TrainerDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  routines: Routine[] = [];
  disabilities: Disability[] = [];
  athleteCount = 0;
  errorMessage: string | null = null;
  quizPassed = false;
  private liveSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private reportsService: ReportsService,
    private router: Router,
    private liveSync: LiveSyncService
  ) {}

  ngOnInit(): void {
    this.reload();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe(() => this.reload(true));
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
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
          if (!silent) {
            this.errorMessage = 'No se pudo cargar el panel del entrenador.';
            this.loading = false;
          }
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
