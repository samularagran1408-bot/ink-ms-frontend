import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_BASE_URL } from '@core/config/api.config';
import { EventoPagoConfig, PagoCheckout, PagoEvento } from '../models/subscriptions';

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {
  private readonly eventosUrl = `${API_BASE_URL}/api/pagos/eventos`;
  private readonly configUrl = `${API_BASE_URL}/api/eventos-pago/configuracion`;

  constructor(private http: HttpClient) {}

  /**
   * Solo trata 404 como “sin config / gratuito”. Timeout, 401 u otros errores
   * no deben convertirse en inscripción gratis silenciosa (RF57).
   */
  obtenerConfiguracionEvento(eventoId: string): Observable<EventoPagoConfig> {
    return this.http.get<EventoPagoConfig>(`${this.configUrl}/${eventoId}`).pipe(
      timeout(8000),
      catchError((err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 404) {
          return of({ esPago: false } as EventoPagoConfig);
        }
        return throwError(() => err);
      })
    );
  }

  inscribirse(eventoId: string): Observable<PagoCheckout> {
    return this.http.post<PagoCheckout>(`${this.eventosUrl}/${eventoId}/inscripcion`, {});
  }

  historialEventos(): Observable<PagoEvento[]> {
    return this.http.get<PagoEvento[]>(`${this.eventosUrl}/historial`);
  }

  descargarComprobanteEvento(pagoId: number): Observable<Blob> {
    return this.http.get(`${this.eventosUrl}/${pagoId}/comprobante`, { responseType: 'blob' });
  }
}
