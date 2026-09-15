import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@core/config/api.config';
import { PagoCheckout, PagoSuscripcion, Plan, Suscripcion } from '../models/subscriptions';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private readonly planesUrl = `${API_BASE_URL}/api/planes`;
  private readonly suscripcionesUrl = `${API_BASE_URL}/api/suscripciones`;

  constructor(private http: HttpClient) {}

  listarPlanes(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.planesUrl);
  }

  obtenerActual(): Observable<Suscripcion> {
    return this.http.get<Suscripcion>(`${this.suscripcionesUrl}/actual`);
  }

  contratar(planId: number, renovacionAutomatica = false): Observable<PagoCheckout> {
    return this.http.post<PagoCheckout>(this.suscripcionesUrl, { planId, renovacionAutomatica });
  }

  renovar(suscripcionId: number, planId?: number): Observable<PagoCheckout> {
    return this.http.post<PagoCheckout>(`${this.suscripcionesUrl}/${suscripcionId}/renovar`, {
      planId: planId ?? null
    });
  }

  listarPagos(suscripcionId: number): Observable<PagoSuscripcion[]> {
    return this.http.get<PagoSuscripcion[]>(`${this.suscripcionesUrl}/${suscripcionId}/pagos`);
  }

  descargarComprobanteSuscripcion(pagoId: number): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/api/pagos/suscripciones/${pagoId}/comprobante`, {
      responseType: 'blob'
    });
  }
}
