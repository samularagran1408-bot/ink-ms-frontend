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
import {
  DashBar,
  buildCountBars,
  buildWeeklyBars,
  countByKey,
  resolveWeeklyTrend
} from '@shared/utils/dashboard-charts.util';

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
  enrollments = 0;
  occupancyPct = 0;
  weeklyBars: DashBar[] = [];
  focusBars: DashBar[] = [];
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
          this.enrollments = panel.metrics?.['enrollments'] ?? this.routines.reduce((sum, routine) => sum + this.occupied(routine), 0);
          this.occupancyPct = panel.metrics?.['occupancy_pct'] ?? this.localOccupancy();
          this.weeklyBars = buildWeeklyBars(resolveWeeklyTrend(panel.weeklyTrend, this.routines));
          this.focusBars = buildCountBars(
            panel.eventCounts && Object.keys(panel.eventCounts).length
              ? panel.eventCounts
              : countByKey(this.routines, 'disabilityFocus', 'General')
          );
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

  get draftsCount(): number {
    return Math.max(this.routines.length - this.publishedCount, 0);
  }

  get hasWeeklyData(): boolean {
    return this.weeklyBars.some((bar) => bar.value > 0);
  }

  goQuiz(): void {
    this.router.navigate(['/trainer/quiz']);
  }

  goSessions(): void {
    this.router.navigate(['/trainer/sessions']);
  }

  goSession(routine: Routine): void {
    this.router.navigate(['/trainer/sessions'], { queryParams: { sesion: routine.id } });
  }

  occupied(routine: Routine): number {
    const max = Number(routine.maxCapacity || 0);
    const available = routine.availableCapacity == null ? max : Number(routine.availableCapacity);
    return Math.max(max - available, 0);
  }

  private localOccupancy(): number {
    const capacity = this.routines.reduce((sum, routine) => sum + Number(routine.maxCapacity || 0), 0);
    if (!capacity) {
      return 0;
    }
    const taken = this.routines.reduce((sum, routine) => sum + this.occupied(routine), 0);
    return Math.round((taken * 100) / capacity);
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
