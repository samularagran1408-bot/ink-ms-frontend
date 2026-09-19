import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { Sport } from '@features/sports-disabilities/models/sports';
import {
  QuizEvaluarResponse,
  QuizGenerarResponse,
  QuizPrepResponse,
  QuizRolePath,
  QuizService
} from '@features/users/services/quiz.service';
import { SessionService } from '@core/services/session.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { SharedModule } from '@shared/shared.module';

/**
 * Pasos del flujo de quiz en la UI.
 * La guía es obligatoria al inicio (primera vez / reintento) antes del prep.
 */
type Step = 'guide' | 'prep' | 'quiz' | 'result';

/**
 * Bloque de la guía de estudio previa al quiz.
 */
interface GuideSection {
  title: string;
  points: string[];
}

/**
 * Pantalla de aptitud: guía → prep → quiz → resultado.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-aptitude-quiz-page',
  templateUrl: './aptitude-quiz-page.component.html',
  styleUrl: './aptitude-quiz-page.component.scss'
})
export class AptitudeQuizPageComponent implements OnInit {
  rolePath: QuizRolePath = 'trainer';
  step: Step = 'guide';
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
   * Secciones de la guía según el rol del quiz.
   */
  get guideSections(): GuideSection[] {
    return this.rolePath === 'trainer' ? this.buildTrainerGuide() : this.buildOrganizerGuide();
  }

  /**
   * Resumen corto de cómo se evalúa el quiz.
   */
  get guideIntro(): string {
    if (this.rolePath === 'trainer') {
      return `Léela con calma antes de continuar. Te orienta sobre qué temas salen en el quiz `
        + `(catálogo, adaptaciones, seguridad y verificación), sin darte las respuestas. `
        + `Son 8 preguntas, umbral ${this.umbral}%. Cuando entres al quiz, esta guía se oculta.`;
    }
    return `Léela con calma antes de continuar. Te ubica en eventos, cupos, inclusión y verificación, `
      + `sin contarte qué opción marcar. Son 8 preguntas, umbral ${this.umbral}%. `
      + `Cuando entres al quiz, esta guía se oculta.`;
  }

  /**
   * Guía de estudio para entrenadores: criterios, no respuestas literales.
   */
  private buildTrainerGuide(): GuideSection[] {
    return [
      {
        title: 'Cómo pensar el catálogo',
        points: [
          'El catálogo es la fuente oficial de deportes y discapacidades: si algo no está ahí, no inventes entidades al vuelo.',
          'Revisa si un deporte está disponible para oferta nueva; el estado del catálogo condiciona lo que puedes planificar.',
          'Una adaptación no es un comentario suelto: relaciona deporte + perfil de discapacidad + cómo se aplica en la práctica.',
          'No todos los roles escriben en el catálogo; piensa quién puede crear o editar esos registros.'
        ]
      },
      {
        title: 'Adaptar sin improvisar a ciegas',
        points: [
          'Parte del canal que la persona sí puede usar: si falla la vista, refuerza oído/tacto; si falla el oído, refuerza lo visual.',
          'Con carga cognitiva alta, reduce complejidad: menos palabras, más pasos claros y repetición útil.',
          'El material y el espacio también son adaptación (no solo “hablar distinto”).',
          'Si un ejercicio del plan no entra, cambia el medio pero conserva el objetivo de la sesión.',
          'Antes de armar la sesión, mira qué adaptaciones ya existen para ese deporte: sirven de base, no de adorno.'
        ]
      },
      {
        title: 'Seguridad en sesión',
        points: [
          'Toda sesión tiene estructura: preparar el cuerpo, trabajar el objetivo y cerrar con recuperación.',
          'Dolor agudo o técnica que se rompe = criterio de parada. Forzar series “por completar el plan” es mala señal.',
          'La carga sube de a poco según cómo responde la persona, no con la misma receta para todos.',
          'Para quien empieza, prioriza recuperación entre días y metas alcanzables; la adherencia importa tanto como la intensidad.',
          'Mide esfuerzo por cómo se siente y se ve la ejecución, no solo por minutos o cantidad de ejercicios en la hoja.'
        ]
      },
      {
        title: 'Qué evalúa la verificación',
        points: [
          `El quiz es una pieza (apruebas con ${this.umbral}% o más), no el único requisito: también se mira trayectoria, formación e identidad.`,
          'Los documentos de identidad sirven para confiar en quién dirige la actividad, no para “rellenar el perfil”.',
          'En las preguntas, descarta opciones que suenen a improvisar, ocultar riesgos o saltarse el catálogo.'
        ]
      }
    ];
  }

  /**
   * Guía de estudio para organizadores: criterios, no respuestas literales.
   */
  private buildOrganizerGuide(): GuideSection[] {
    return [
      {
        title: 'Ciclo de un evento',
        points: [
          'Crear un evento exige rol autorizado y un deporte que ya exista en el catálogo (no un nombre inventado en la descripción).',
          'Fecha y hora deben situar el evento en el calendario de forma usable; el cupo se define con números que tengan sentido operativo.',
          'Los estados marcan si el evento es editable, público para inscripción, o ya cerrado. Cancelar no es lo mismo que borrar el historial.',
          'El sistema también mueve estados con el tiempo: no asumas que un borrador “se queda así para siempre”.'
        ]
      },
      {
        title: 'Cupos y asistencia',
        points: [
          'Cuando se llena el aforo, el flujo correcto no es rechazar en seco ni agrandar el cupo solo: hay un mecanismo ordenado de espera.',
          'Si se libera una plaza, alguien de esa espera debería poder avanzar.',
          'Dimensiona el cupo según espacio, apoyos y personal real; un número “bonito” que no puedes atender es un problema.',
          'La asistencia se comprueba con el mecanismo de la inscripción (no con datos improvisados). Mide éxito con asistencia real, no solo con likes o fotos.'
        ]
      },
      {
        title: 'Inclusión al publicar',
        points: [
          'Antes de publicar, cruza el deporte con las adaptaciones del catálogo y escribe solo lo que sí vas a ofrecer.',
          'Una buena descripción orienta: cómo llegar, cuándo es y qué apoyos hay. La sede importa (acceso, baños, transporte).',
          'Piensa el canal de apoyo según el perfil: señales visuales cuando falla el oído; guías y descripción cuando falla la vista.',
          'Si alguien pide un apoyo no previsto, valora un ajuste razonable. Los datos de inscritos son confidenciales y solo para gestionar el evento.'
        ]
      },
      {
        title: 'Qué evalúa la verificación',
        points: [
          `El quiz pide ${this.umbral}% o más, pero la verificación también mira práctica (evento de prueba), contacto real y trayectoria en la plataforma.`,
          'Contacto verificado = poder localizarte si hay una incidencia, no un trámite vacío.',
          'Si dos opciones suenan parecidas, quédate con la que conserva historial, cupos justos y accesibilidad real.'
        ]
      }
    ];
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
    this.step = 'guide';
    this.bootstrap();
  }

  /**
   * Tras leer la guía, pasa al registro de experiencia y disciplinas.
   */
  continueFromGuide(): void {
    this.errorMessage = null;
    this.step = 'prep';
  }

  /**
   * Vuelve a la guía desde el prep (sin perder disciplinas seleccionadas).
   */
  backToGuide(): void {
    this.step = 'guide';
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
          // Siempre arranca en la guía si aún no presentó / no aprobó.
          if (this.step !== 'result') {
            this.step = 'guide';
          }
          this.loading = false;
        },
        error: () => {
          this.sports = [];
          this.prep = null;
          this.step = 'guide';
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
