import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';

/**
 * Ruta de rol usada en los endpoints de quiz (users + AI).
 */
export type QuizRolePath = 'trainer' | 'organizer';

/**
 * Body del paso previo: experiencia y disciplinas seleccionadas.
 */
export interface QuizPrepRequest {
  experienceYears: number;
  disciplineSportIds: number[];
}

/**
 * Estado de prep/intentos/aprobación devuelto por ink-ms-users.
 */
export interface QuizPrepResponse {
  role: string;
  canStartQuiz: boolean;
  quizPassed: boolean;
  experienceYears?: number;
  disciplineSportIds?: number[];
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  lastScore?: number;
  message?: string;
}

/**
 * Opción pública de una pregunta (sin indicar si es correcta).
 */
export interface QuizOpcion {
  id: string;
  texto: string;
}

/**
 * Pregunta pública enviada al cliente para responder.
 */
export interface QuizPregunta {
  id: string;
  enunciado: string;
  opciones: QuizOpcion[];
  tema?: string;
}

/**
 * Respuesta de generación del asistente IA.
 */
export interface QuizGenerarResponse {
  quiz_id: string;
  rol: string;
  umbral_aprobacion: number;
  num_preguntas: number;
  preguntas: QuizPregunta[];
  contexto?: Record<string, unknown>;
  mensaje?: string;
}

/**
 * Resultado de evaluación del quiz (score, aprobado, siguientes pasos).
 */
export interface QuizEvaluarResponse {
  quiz_id: string;
  rol: string;
  score: number;
  correctas: number;
  total: number;
  aprobado: boolean;
  umbral_aprobacion: number;
  detalle: Array<Record<string, unknown>>;
  temas_a_reforzar: string[];
  score_registrado_en_users: boolean;
  siguiente_paso: string;
}

/**
 * Cliente HTTP del flujo de quiz (prep en users + generar/evaluar en AI).
 */
@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private readonly usersUrl = `${API_BASE_URL}/api/users/verify`;
  private readonly aiUrl = `${API_BASE_URL}/api/ai/quiz`;

  constructor(private http: HttpClient) {}

  /**
   * Consulta si el usuario puede iniciar el quiz y cuántos intentos le quedan.
   */
  getPrepStatus(role: QuizRolePath, userId: string): Observable<QuizPrepResponse> {
    return this.http.get<QuizPrepResponse>(`${this.usersUrl}/quiz/prep/${role}/${userId}`);
  }

  /**
   * Guarda experiencia y disciplinas; puede devolver 403 con acceso revocado.
   */
  prepare(role: QuizRolePath, userId: string, body: QuizPrepRequest): Observable<QuizPrepResponse> {
    return this.http.post<QuizPrepResponse>(`${this.usersUrl}/quiz/prep/${role}/${userId}`, body);
  }

  /**
   * Solicita al asistente IA un quiz nuevo personalizado por disciplinas.
   */
  generate(role: QuizRolePath, body: {
    usuario_id: string;
    num_preguntas?: number;
    dificultad?: string;
    discipline_sport_ids?: number[];
  }): Observable<QuizGenerarResponse> {
    return this.http.post<QuizGenerarResponse>(`${this.aiUrl}/${role}/generar`, body);
  }

  /**
   * Envía respuestas al asistente IA y registra el score en users.
   */
  evaluate(role: QuizRolePath, body: {
    usuario_id: string;
    quiz_id: string;
    respuestas: Array<{ pregunta_id: string; opcion_id: string }>;
  }): Observable<QuizEvaluarResponse> {
    return this.http.post<QuizEvaluarResponse>(`${this.aiUrl}/${role}/evaluar`, {
      ...body,
      registrar_en_users: true
    });
  }
}
