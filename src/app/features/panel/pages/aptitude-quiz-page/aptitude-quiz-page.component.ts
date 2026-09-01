import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { Sport } from '../../../../core/models/sports';
import {
  QuizEvaluarResponse,
  QuizGenerarResponse,
  QuizPrepResponse,
  QuizRolePath,
  QuizService
} from '../../../../core/services/quiz.service';
import { SessionService } from '../../../../core/services/session.service';
import { ReportsService } from '../../../../core/services/reports.service';

/**
 * Pasos del flujo de quiz en la UI.
 */
type Step = 'prep' | 'quiz' | 'result';

/**
 * Pantalla de aptitud: prep (experiencia + disciplinas) → quiz → resultado.
 */
@Component({
  selector: 'app-aptitude-quiz-page',
  templateUrl: './aptitude-quiz-page.component.html',
  styleUrl: './aptitude-quiz-page.component.scss'
})
export class AptitudeQuizPageComponent implements OnInit {
  rolePath: QuizRolePath = 'trainer';
  step: Step = 'prep';
  loading = true;
  busy = false;
  sports: Sport[] = [];
  prep: QuizPrepResponse | null = null;
  quiz: QuizGenerarResponse | null = null;
  result: QuizEvaluarResponse | null = null;
  answers: Record<string, string> = {};
  selectedSports = new Set<number>();
  errorMessage: string | null = null;
  infoMessage: string | null = null;

  prepForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private quizService: QuizService,
    private session: SessionService,
    private reportsService: ReportsService
  ) {
    this.prepForm = this.fb.group({
      experienceYears: [3, [Validators.required, Validators.min(0), Validators.max(80)]]
    });
  }

  /**
   * Detecta el rol (trainer/organizer) desde la ruta y carga el estado inicial.
   */
  ngOnInit(): void {
    const path = this.route.snapshot.data['quizRolePath'] as QuizRolePath | undefined;
    this.rolePath = path || (this.router.url.includes('/organizer/') ? 'organizer' : 'trainer');
    this.bootstrap();
  }

  /**
   * Etiqueta legible del rol para la cabecera.
   */
  get roleLabel(): string {
    return this.rolePath === 'trainer' ? 'entrenador' : 'organizador';
  }

  /**
   * Umbral de aprobación según el rol (75 entrenador / 70 organizador).
   */
  get umbral(): number {
    return this.rolePath === 'trainer' ? 75 : 70;
  }

  /**
   * Ruta home del panel según el rol actual.
   */
  get homePath(): string {
    return this.rolePath === 'trainer' ? '/trainer' : '/organizer';
  }

  /**
   * Alterna la selección de una disciplina del catálogo.
   */
  toggleSport(id: number): void {
    if (this.selectedSports.has(id)) {
      this.selectedSports.delete(id);
    } else {
      this.selectedSports.add(id);
    }
  }

  /**
   * Indica si un deporte está seleccionado en el prep.
   */
  isSportSelected(id: number): boolean {
    return this.selectedSports.has(id);
  }

  /**
   * Envía experiencia y disciplinas; si el acceso se revoca, cierra sesión.
   */
  submitPrep(): void {
    if (this.prepForm.invalid || !this.selectedSports.size) {
      this.errorMessage = 'Indica tus años de experiencia y al menos una disciplina.';
      return;
    }
    const profile = this.session.getProfile();
    if (!profile?.id) {
      this.errorMessage = 'No se pudo identificar tu usuario.';
      return;
    }

    this.busy = true;
    this.errorMessage = null;
    this.quizService.prepare(this.rolePath, profile.id, {
      experienceYears: Number(this.prepForm.value.experienceYears),
      disciplineSportIds: Array.from(this.selectedSports)
    }).subscribe({
      next: (prep) => {
        this.prep = prep;
        this.busy = false;
        if (prep.canStartQuiz || prep.quizPassed) {
          this.startQuiz();
        } else {
          this.infoMessage = prep.message || 'Datos guardados.';
        }
      },
      error: (err: HttpErrorResponse) => {
        this.busy = false;
        this.handleAccessError(err);
      }
    });
  }

  /**
   * Pide al asistente IA un quiz nuevo con las disciplinas seleccionadas.
   */
  startQuiz(): void {
    const profile = this.session.getProfile();
    if (!profile?.id) {
      return;
    }
    this.busy = true;
    this.errorMessage = null;
    this.quizService.generate(this.rolePath, {
      usuario_id: profile.id,
      num_preguntas: 8,
      dificultad: 'media',
      discipline_sport_ids: Array.from(this.selectedSports)
    }).subscribe({
      next: (quiz) => {
        this.quiz = quiz;
        this.answers = {};
        this.step = 'quiz';
        this.busy = false;
      },
      error: (err: HttpErrorResponse) => {
        this.busy = false;
        this.errorMessage = this.readError(err) || 'No se pudo generar el quiz.';
      }
    });
  }

  /**
   * Guarda la opción elegida para una pregunta.
   */
  selectAnswer(preguntaId: string, opcionId: string): void {
    this.answers[preguntaId] = opcionId;
  }

  /**
   * Evalúa todas las respuestas y refresca el perfil tras el resultado.
   */
  submitQuiz(): void {
    if (!this.quiz) {
      return;
    }
    const profile = this.session.getProfile();
    if (!profile?.id) {
      return;
    }
    const faltantes = this.quiz.preguntas.filter((p) => !this.answers[p.id]);
    if (faltantes.length) {
      this.errorMessage = `Responde todas las preguntas (${faltantes.length} pendientes).`;
      return;
    }

    this.busy = true;
    this.errorMessage = null;
    this.quizService.evaluate(this.rolePath, {
      usuario_id: profile.id,
      quiz_id: this.quiz.quiz_id,
      respuestas: Object.entries(this.answers).map(([pregunta_id, opcion_id]) => ({
        pregunta_id,
        opcion_id
      }))
    }).subscribe({
      next: (result) => {
        this.result = result;
        this.step = 'result';
        this.busy = false;
        this.session.loadProfile(true).subscribe();
      },
      error: (err: HttpErrorResponse) => {
        this.busy = false;
        this.errorMessage = this.readError(err) || 'No se pudo evaluar el quiz.';
      }
    });
  }

  /**
   * Reinicia el flujo para un nuevo intento (si quedan disponibles).
   */
  retry(): void {
    this.result = null;
    this.quiz = null;
    this.answers = {};
    this.step = 'prep';
    this.bootstrap();
  }

  /**
   * Navega al panel del rol tras aprobar el quiz.
   */
  goHome(): void {
    this.router.navigate([this.homePath]);
  }

  /**
   * Carga perfil, deportes y estado de prep; si ya aprobó, muestra resultado directo.
   */
  private bootstrap(): void {
    this.loading = true;
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      if (!profile?.id) {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar tu perfil.';
        return;
      }

      if (
        (this.rolePath === 'trainer' && profile.trainerQuizPassed)
        || (this.rolePath === 'organizer' && profile.organizerQuizPassed)
      ) {
        this.step = 'result';
        this.result = {
          quiz_id: '',
          rol: this.rolePath.toUpperCase(),
          score: this.rolePath === 'trainer' ? (profile.trainerQuizScore || 100) : (profile.organizerQuizScore || 100),
          correctas: 0,
          total: 0,
          aprobado: true,
          umbral_aprobacion: this.umbral,
          detalle: [],
          temas_a_reforzar: [],
          score_registrado_en_users: true,
          siguiente_paso: 'Quiz ya aprobado. Ya puedes gestionar tu panel.'
        };
        this.loading = false;
        return;
      }

      this.reportsService.getQuizPanel(this.rolePath, profile.id).subscribe({
        next: (panel) => {
          this.sports = panel.sports || [];
          const prep = (panel.quizPrep || null) as unknown as QuizPrepResponse | null;
          this.prep = prep && Object.keys(prep).length ? prep : null;
          if (prep?.disciplineSportIds?.length) {
            this.selectedSports = new Set(prep.disciplineSportIds);
          }
          if (prep?.experienceYears != null) {
            this.prepForm.patchValue({ experienceYears: prep.experienceYears });
          }
          if (prep?.attemptsRemaining === 0 && !prep.quizPassed) {
            this.errorMessage = 'Has agotado los intentos de verificación.';
          }
          this.loading = false;
        },
        error: () => {
          this.sports = [];
          this.prep = null;
          this.loading = false;
        }
      });
    });
  }

  /**
   * Trata 403/accessRevoked con mensaje genérico y cierra sesión (bloqueo silencioso).
   */
  private handleAccessError(err: HttpErrorResponse): void {
    const body = err.error as { accessRevoked?: boolean; message?: string } | null;
    if (err.status === 403 || body?.accessRevoked) {
      this.errorMessage = body?.message || 'No se pudo completar el acceso.';
      setTimeout(() => this.session.logout(), 1600);
      return;
    }
    this.errorMessage = this.readError(err) || 'No se pudieron guardar los datos previos.';
  }

  /**
   * Extrae mensaje útil desde cuerpos de error de Spring/FastAPI.
   */
  private readError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) {
      return null;
    }
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    return null;
  }
}
