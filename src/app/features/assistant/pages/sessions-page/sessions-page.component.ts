import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Routine, RoutineRegistration, Sport } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { AiAssistantService } from '@features/assistant/services/ai-assistant.service';
import { matchesQuery } from '@core/utils/search.util';
import { userInitials } from '@core/utils/avatar.util';
import { SharedModule } from '@shared/shared.module';

type AttendanceFilter = 'all' | 'attended' | 'absent';

interface AthleteProgress {
  loading: boolean;
  error?: string;
  planPct?: number;
  sesionesHechas?: number;
  sesionesObjetivo?: number;
  sesionesPct?: number;
  asistenciaPct?: number;
  asistidos?: number;
  confirmados?: number;
  rutinas?: number;
  rpe?: number | string;
  riesgo?: string;
  tendencia?: string;
  modoCompetencia?: boolean;
  objetivo?: string | null;
}

interface SessionAthleteRow extends RoutineRegistration {
  attended: boolean;
  cancelled: boolean;
}

interface SessionSummaryView {
  routine: Routine;
  registrations: SessionAthleteRow[];
  visibleAthletes: SessionAthleteRow[];
  enrolledCount: number;
  attendedCount: number;
  absentCount: number;
  filter: AttendanceFilter;
  expanded: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-sessions-page',
  templateUrl: './sessions-page.component.html',
  styleUrl: './sessions-page.component.scss'
})
export class SessionsPageComponent implements OnInit, OnDestroy {
  summaries: SessionSummaryView[] = [];
  sports: Sport[] = [];
  form: FormGroup;
  searchQuery = '';
  errorMessage: string | null = null;
  successMessage: string | null = null;
  loading = true;
  progressByUser: Record<string, AthleteProgress> = {};
  private pendingSessionId: string | null = null;
  private liveSub: Subscription | null = null;
  private querySub: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private confirm: ConfirmDialogService,
    private liveSync: LiveSyncService,
    private ai: AiAssistantService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      sportId: [null],
      description: [''],
      disabilityFocus: [''],
      level: ['principiante'],
      durationMinutes: [60, [Validators.min(1)]],
      maxCapacity: [10, [Validators.min(1)]],
      exercisesJson: ['[]']
    });
  }

  ngOnInit(): void {
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.pendingSessionId = params.get('sesion');
      this.applyPendingExpand();
    });
    this.reload();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe(() => this.reload(true));
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  get filteredSummaries(): SessionSummaryView[] {
    const q = this.searchQuery.trim();
    if (!q) {
      return this.summaries;
    }
    return this.summaries.filter((summary) =>
      matchesQuery(q, summary.routine.name, summary.routine.status, summary.routine.disabilityFocus, summary.routine.description)
      || summary.visibleAthletes.length > 0
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyView();
  }

  onSearchChange(): void {
    this.applyView();
  }

  occupied(routine: Routine): number {
    const max = Number(routine.maxCapacity || 0);
    const available = routine.availableCapacity == null ? max : Number(routine.availableCapacity);
    return Math.max(max - available, 0);
  }

  initials(name?: string | null): string {
    return userInitials(name);
  }

  trackBySummary(_index: number, summary: SessionSummaryView): string {
    return summary.routine.id;
  }

  trackByAthlete(_index: number, row: SessionAthleteRow): string {
    return row.id || row.userId || String(_index);
  }

  toggle(summary: SessionSummaryView): void {
    summary.expanded = !summary.expanded;
    if (summary.expanded) {
      this.loadProgress(summary);
    }
  }

  setFilter(summary: SessionSummaryView, filter: AttendanceFilter): void {
    summary.filter = filter;
    this.applyView();
  }

  progressOf(userId?: string): AthleteProgress | null {
    if (!userId) {
      return null;
    }
    return this.progressByUser[userId] || null;
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.withTrainerId((trainerId) => {
      this.reportsService.getSessionsPanel(trainerId).subscribe({
        next: (panel) => {
          const prev = new Map(this.summaries.map((row) => [row.routine.id, row]));
          this.sports = panel.sports || [];
          if (this.sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: this.sports[0].id });
          }
          const fromSummaries = panel.sessionSummaries || [];
          if (fromSummaries.length) {
            this.summaries = fromSummaries.map((row) => this.toSummary(row.routine, row.registrations || [], {
              enrolledCount: row.enrolledCount,
              attendedCount: row.attendedCount,
              absentCount: row.absentCount
            }, prev.get(row.routine.id)));
          } else {
            this.summaries = (panel.routines || []).map((routine) =>
              this.toSummary(routine, [], {}, prev.get(routine.id))
            );
          }
          this.applyView();
          this.applyPendingExpand();
          this.loading = false;
        },
        error: (error) => {
          if (!silent) {
            this.errorMessage = error?.error?.message || 'No se pudieron cargar sesiones.';
            this.loading = false;
          }
        }
      });
    });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    void this.confirmCreate();
  }

  publish(routine: Routine): void {
    void this.confirmPublish(routine);
  }

  markAttendance(summary: SessionSummaryView, row: SessionAthleteRow): void {
    void this.confirmAttendance(summary, row);
  }

  private async confirmCreate(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Crear sesión',
      message: `¿Confirmas crear la rutina "${this.form.value.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    this.withTrainerId((trainerId) => {
      const exercisesRaw = String(this.form.value.exercisesJson || '').trim();
      const payload = {
        ...this.form.value,
        trainerId,
        sportId: this.form.value.sportId ? Number(this.form.value.sportId) : undefined,
        durationMinutes: Number(this.form.value.durationMinutes),
        maxCapacity: Number(this.form.value.maxCapacity),
        exercisesJson: exercisesRaw && exercisesRaw !== 'null' ? exercisesRaw : '[]'
      };

      this.sportsService.createRoutine(payload).subscribe({
        next: () => {
          this.successMessage = 'Sesión creada.';
          this.errorMessage = null;
          this.form.patchValue({ name: '', description: '', disabilityFocus: '', exercisesJson: '[]' });
          this.reload();
        },
        error: (error) => {
          this.successMessage = null;
          this.errorMessage = error?.error?.message || 'No se pudo crear la sesión.';
        }
      });
    });
  }

  private async confirmPublish(routine: Routine): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Publicar sesión',
      message: `¿Confirmas publicar "${routine.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.publishRoutine(routine.id).subscribe({
      next: () => {
        this.successMessage = 'Sesión publicada.';
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo publicar.'
    });
  }

  private async confirmAttendance(summary: SessionSummaryView, row: SessionAthleteRow): Promise<void> {
    const next = !row.attended;
    const name = row.userFullName || row.userEmail || 'este atleta';
    const ok = await this.confirm.ask({
      title: next ? 'Registrar asistencia' : 'Quitar asistencia',
      message: next
        ? `¿Confirmas que ${name} asistió a "${summary.routine.name}"?`
        : `¿Confirmas quitar la asistencia de ${name} en "${summary.routine.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.markRoutineAttendance(row.id, next).subscribe({
      next: (updated) => {
        row.status = updated.status || (next ? 'completed' : 'active');
        row.attended = next;
        this.successMessage = updated.message || (next ? 'Asistencia registrada.' : 'Asistencia desmarcada.');
        this.errorMessage = null;
        this.applyView();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo actualizar la asistencia.';
      }
    });
  }

  private applyView(): void {
    this.summaries.forEach((summary) => {
      const enrolled = summary.registrations.filter((row) => !row.cancelled);
      summary.enrolledCount = enrolled.length;
      summary.attendedCount = enrolled.filter((row) => row.attended).length;
      summary.absentCount = summary.enrolledCount - summary.attendedCount;
      summary.visibleAthletes = this.computeAthletes(summary);
    });
  }

  private computeAthletes(summary: SessionSummaryView): SessionAthleteRow[] {
    let rows = summary.registrations.filter((row) => !row.cancelled);
    if (summary.filter === 'attended') {
      rows = rows.filter((row) => row.attended);
    } else if (summary.filter === 'absent') {
      rows = rows.filter((row) => !row.attended);
    }
    return rows.filter((row) =>
      matchesQuery(this.searchQuery, row.userFullName, row.userEmail, row.userDisability, row.status)
    );
  }

  private applyPendingExpand(): void {
    if (!this.pendingSessionId || !this.summaries.length) {
      return;
    }
    const target = this.summaries.find((row) => row.routine.id === this.pendingSessionId);
    if (!target) {
      return;
    }
    target.expanded = true;
    this.loadProgress(target);
  }

  private loadProgress(summary: SessionSummaryView): void {
    const ids = [...new Set(
      summary.registrations
        .filter((row) => !row.cancelled && row.userId)
        .map((row) => row.userId)
    )];
    const missing = ids.filter((id) => {
      const current = this.progressByUser[id];
      return !current || (!current.loading && current.error);
    });
    missing.forEach((id) => {
      this.progressByUser[id] = { loading: true };
    });
    if (!missing.length) {
      return;
    }
    forkJoin(missing.map((id) =>
      this.ai.dashboard(id).pipe(
        catchError(() => of({ __error: true, usuario_id: id } as Record<string, unknown>))
      )
    )).subscribe((payloads) => {
      payloads.forEach((raw, index) => {
        const userId = missing[index];
        if (raw && raw['__error']) {
          this.progressByUser[userId] = { loading: false, error: 'Sin datos de progreso.' };
          return;
        }
        this.progressByUser[userId] = this.toProgress(raw || {});
      });
    });
  }

  private toProgress(raw: Record<string, unknown>): AthleteProgress {
    const vista = (raw['vista'] && typeof raw['vista'] === 'object')
      ? raw['vista'] as Record<string, unknown>
      : {};
    const modo = (raw['modo_competencia'] && typeof raw['modo_competencia'] === 'object')
      ? raw['modo_competencia'] as Record<string, unknown>
      : {};
    const panel = (vista['progreso_panel'] && typeof vista['progreso_panel'] === 'object')
      ? vista['progreso_panel'] as Record<string, unknown>
      : {};
    const kpis = Array.isArray(vista['kpis']) ? vista['kpis'] as Array<Record<string, unknown>> : [];
    const kpi = (clave: string) => kpis.find((item) => item['clave'] === clave);
    return {
      loading: false,
      planPct: this.toNumber(modo['plan_pct'] ?? vista['plan_pct']),
      sesionesHechas: this.toNumber(modo['sesiones_hechas'] ?? vista['sesiones_hechas'] ?? raw['sesiones_hechas']),
      sesionesObjetivo: this.toNumber(modo['sesiones_objetivo'] ?? vista['sesiones_objetivo'] ?? raw['sesiones_objetivo']),
      sesionesPct: this.toNumber(modo['sesiones_pct'] ?? vista['sesiones_pct'] ?? raw['sesiones_pct']),
      asistenciaPct: this.toNumber(panel['asistencia_pct']),
      asistidos: this.toNumber(panel['asistidos']),
      confirmados: this.toNumber(panel['confirmados']),
      rutinas: this.toNumber(panel['rutinas'] ?? panel['inscripciones']),
      rpe: (kpi('rpe')?.['valor'] as number | string | undefined) ?? '—',
      riesgo: String(kpi('riesgo')?.['valor'] || vista['riesgo'] || '—'),
      tendencia: String(vista['tendencia'] || raw['tendencia'] || '—'),
      modoCompetencia: !!(modo['activo'] || vista['modo_competencia']),
      objetivo: (modo['objetivo'] as string) || (vista['objetivo_competencia'] as string) || null
    };
  }

  private toNumber(value: unknown): number | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private toSummary(
    routine: Routine,
    registrations: RoutineRegistration[],
    counts: { enrolledCount?: number; attendedCount?: number; absentCount?: number },
    previous?: SessionSummaryView
  ): SessionSummaryView {
    const rows: SessionAthleteRow[] = (registrations || []).map((item) => {
      const status = String(item.status || 'active').toLowerCase();
      return {
        ...item,
        attended: status === 'completed',
        cancelled: status === 'cancelled'
      };
    });
    const enrolled = rows.filter((row) => !row.cancelled);
    return {
      routine,
      registrations: rows,
      visibleAthletes: enrolled,
      enrolledCount: counts.enrolledCount ?? enrolled.length,
      attendedCount: counts.attendedCount ?? enrolled.filter((row) => row.attended).length,
      absentCount: counts.absentCount ?? enrolled.filter((row) => !row.attended).length,
      filter: previous?.filter || 'all',
      expanded: previous?.expanded || false
    };
  }

  private withTrainerId(action: (trainerId: string) => void): void {
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      const trainerId = profile?.id;
      if (!trainerId) {
        this.loading = false;
        this.errorMessage = 'Perfil de entrenador no disponible.';
        return;
      }
      action(trainerId);
    });
  }
}
