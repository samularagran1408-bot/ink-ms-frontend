import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@core/config/api.config';
import {
  CambiarEstadoSuscripcionRequest,
  ConfiguracionEventoPagoRequest,
  ConfiguracionEventoPagoResponse,
  CrearSuscripcionRequest,
  HistorialSuscripcionResponse,
  PagoCheckoutResponse,
  PagoEstadoResponse,
  PagoEventoResponse,
  PagoSuscripcionResponse,
  PagoTarjetaRequest,
  Plan,
  PlanRequest,
  PuedeCrearEventoResponse,
  ReporteFinancieroResponse,
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

  /** RF61 - historial de movimientos (creación/renovación/cambio de plan/cancelación). */
  getHistorialSuscripcion(suscripcionId: number): Observable<HistorialSuscripcionResponse[]> {
    return this.http.get<HistorialSuscripcionResponse[]>(`${this.base}/api/suscripciones/${suscripcionId}/historial`);
  }

  // -------------------------------------------------------------------------
  // RF65 - Administración de planes (ADMIN)
  // -------------------------------------------------------------------------

  getPlanesAdmin(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.base}/api/planes/admin`);
  }

  crearPlan(body: PlanRequest): Observable<Plan> {
    return this.http.post<Plan>(`${this.base}/api/planes/admin`, body);
  }

  actualizarPlan(id: number, body: PlanRequest): Observable<Plan> {
    return this.http.put<Plan>(`${this.base}/api/planes/admin/${id}`, body);
  }

  desactivarPlan(id: number): Observable<Plan> {
    return this.http.patch<Plan>(`${this.base}/api/planes/admin/${id}/desactivar`, {});
  }

  // -------------------------------------------------------------------------
  // RF58 - Gestión admin de suscripciones ajenas
  // -------------------------------------------------------------------------

  cambiarEstadoSuscripcion(suscripcionId: number, body: CambiarEstadoSuscripcionRequest): Observable<SuscripcionResponse> {
    return this.http.patch<SuscripcionResponse>(`${this.base}/api/suscripciones/admin/${suscripcionId}/estado`, body);
  }

  getHistorialPorOrganizador(organizadorId: string): Observable<HistorialSuscripcionResponse[]> {
    return this.http.get<HistorialSuscripcionResponse[]>(
      `${this.base}/api/suscripciones/admin/organizadores/${encodeURIComponent(organizadorId)}/historial`,
    );
  }

  /** RF58 - suscripciones de un organizador ajeno, más reciente primero. */
  getSuscripcionesPorOrganizador(organizadorId: string): Observable<SuscripcionResponse[]> {
    return this.http.get<SuscripcionResponse[]>(
      `${this.base}/api/suscripciones/admin/organizadores/${encodeURIComponent(organizadorId)}/suscripciones`,
    );
  }

  /** RF58 - listado global para el panel admin (Mongo no tiene JOIN; el correo viene resuelto). */
  getSuscripcionesAdmin(): Observable<SuscripcionResponse[]> {
    return this.http.get<SuscripcionResponse[]>(`${this.base}/api/suscripciones/admin`);
  }

  // -------------------------------------------------------------------------
  // RF55, RF63 - Configuración de eventos de pago (organizador)
  // -------------------------------------------------------------------------

  configurarEventoPago(body: ConfiguracionEventoPagoRequest): Observable<ConfiguracionEventoPagoResponse> {
    return this.http.post<ConfiguracionEventoPagoResponse>(`${this.base}/api/eventos-pago/configuracion`, body);
  }

  actualizarConfiguracionEventoPago(eventoId: string, body: ConfiguracionEventoPagoRequest): Observable<ConfiguracionEventoPagoResponse> {
    return this.http.put<ConfiguracionEventoPagoResponse>(
      `${this.base}/api/eventos-pago/configuracion/${encodeURIComponent(eventoId)}`,
      body,
    );
  }

  getConfiguracionEventoPago(eventoId: string): Observable<ConfiguracionEventoPagoResponse> {
    return this.http.get<ConfiguracionEventoPagoResponse>(
      `${this.base}/api/eventos-pago/configuracion/${encodeURIComponent(eventoId)}`,
    );
  }

  getConfiguracionesEventoPagoPropias(): Observable<ConfiguracionEventoPagoResponse[]> {
    return this.http.get<ConfiguracionEventoPagoResponse[]>(`${this.base}/api/eventos-pago/configuracion`);
  }

  // -------------------------------------------------------------------------
  // RF57 - Inscripción y pago a eventos
  // -------------------------------------------------------------------------

  inscribirseEvento(eventoId: string): Observable<PagoCheckoutResponse> {
    return this.http.post<PagoCheckoutResponse>(
      `${this.base}/api/pagos/eventos/${encodeURIComponent(eventoId)}/inscripcion`,
      {},
    );
  }

  getHistorialPagosEventos(): Observable<PagoEventoResponse[]> {
    return this.http.get<PagoEventoResponse[]>(`${this.base}/api/pagos/eventos/historial`);
  }

  /** RF66 - ingresos por inscripción de los eventos del organizador autenticado. */
  getHistorialPagosEventosRecibidos(): Observable<PagoEventoResponse[]> {
    return this.http.get<PagoEventoResponse[]>(`${this.base}/api/pagos/eventos/recibidos`);
  }

  /** RF61 - pagos de planes del organizador autenticado (todas sus suscripciones). */
  getHistorialPagosSuscripcion(): Observable<PagoSuscripcionResponse[]> {
    return this.http.get<PagoSuscripcionResponse[]>(`${this.base}/api/pagos/suscripciones/historial`);
  }

  descargarComprobanteSuscripcion(pagoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/api/pagos/suscripciones/${pagoId}/comprobante`, { responseType: 'blob' });
  }

  descargarComprobanteEvento(pagoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/api/pagos/eventos/${pagoId}/comprobante`, { responseType: 'blob' });
  }

  puedeCrearEvento(organizadorId: string): Observable<PuedeCrearEventoResponse> {
    return this.http.get<PuedeCrearEventoResponse>(
      `${this.base}/api/internal/suscripciones/organizadores/${encodeURIComponent(organizadorId)}/puede-crear-evento`,
    );
  }

  // -------------------------------------------------------------------------
  // RF62 - Reportes financieros
  // -------------------------------------------------------------------------

  getReporteFinancieroPropio(desde?: string, hasta?: string): Observable<ReporteFinancieroResponse> {
    return this.http.get<ReporteFinancieroResponse>(`${this.base}/api/reportes/financiero`, {
      params: this.rangoParams(desde, hasta),
    });
  }

  getReporteFinancieroGlobal(desde?: string, hasta?: string): Observable<ReporteFinancieroResponse> {
    return this.http.get<ReporteFinancieroResponse>(`${this.base}/api/reportes/admin/financiero`, {
      params: this.rangoParams(desde, hasta),
    });
  }

  private rangoParams(desde?: string, hasta?: string): HttpParams {
    let params = new HttpParams();
    if (desde) {
      params = params.set('desde', desde);
    }
    if (hasta) {
      params = params.set('hasta', hasta);
    }
    return params;
  }
}
