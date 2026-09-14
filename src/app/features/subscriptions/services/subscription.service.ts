import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@core/config/api.config';
import {
  CrearSuscripcionRequest,
  PagoCheckoutResponse,
  PagoEstadoResponse,
  PagoSuscripcionResponse,
  PagoTarjetaRequest,
  Plan,
  SuscripcionResponse,
} from '../models/subscription-models';

/**
 * M09 - Suscripciones y monetización. Habla con ink-ms-subscriptions a través del
 * gateway (`/api/planes`, `/api/suscripciones`, `/api/pagos`). El JWT lo añade
 * el AuthInterceptor global; aquí no se manipulan cabeceras.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly base = API_BASE_URL;

  constructor(private readonly http: HttpClient) {}

  /** RF54 - planes activos (usuario / organizador). */
  getPlanes(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.base}/api/planes`);
  }

  /** RF57 - suscripción vigente del organizador autenticado (404 si aún no tiene). */
  getSuscripcionActual(): Observable<SuscripcionResponse> {
    return this.http.get<SuscripcionResponse>(`${this.base}/api/suscripciones/actual`);
  }

  /** RF56 - crea la solicitud de suscripción y devuelve el pago (o la activa, si es gratuita). */
  crearSuscripcion(body: CrearSuscripcionRequest): Observable<PagoCheckoutResponse> {
    return this.http.post<PagoCheckoutResponse>(`${this.base}/api/suscripciones`, body);
  }

  /** RF59 - renovación o cambio de plan de una suscripción existente. */
  renovarSuscripcion(suscripcionId: number, planId?: number): Observable<PagoCheckoutResponse> {
    return this.http.post<PagoCheckoutResponse>(
      `${this.base}/api/suscripciones/${suscripcionId}/renovar`,
      planId != null ? { planId } : {},
    );
  }

  /** RF61 - historial de pagos de la suscripción. */
  getPagosSuscripcion(suscripcionId: number): Observable<PagoSuscripcionResponse[]> {
    return this.http.get<PagoSuscripcionResponse[]>(`${this.base}/api/suscripciones/${suscripcionId}/pagos`);
  }

  /**
   * RF70 - estado del cobro. Si se pasa `paymentId` y el pago sigue PENDIENTE, el
   * backend fuerza la consulta contra Mercado Pago en lugar de esperar al webhook.
   */
  consultarEstadoPago(referencia: string, paymentId?: string | null): Observable<PagoEstadoResponse> {
    let params = new HttpParams();
    if (paymentId) {
      params = params.set('paymentId', paymentId);
    }
    return this.http.get<PagoEstadoResponse>(
      `${this.base}/api/pagos/${encodeURIComponent(referencia)}/estado`,
      { params },
    );
  }

  /**
   * RF70 - checkout propio (sin la interfaz de Mercado Pago): cobra un pago PENDIENTE
   * con el token de tarjeta que generó el SDK JS en el navegador.
   */
  pagarConTarjeta(referencia: string, datos: PagoTarjetaRequest): Observable<PagoEstadoResponse> {
    return this.http.post<PagoEstadoResponse>(
      `${this.base}/api/pagos/${encodeURIComponent(referencia)}/pagar-tarjeta`,
      datos,
    );
  }
}
