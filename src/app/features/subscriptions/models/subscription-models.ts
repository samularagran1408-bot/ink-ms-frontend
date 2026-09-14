/** M09 - Suscripciones: modelos alineados con los DTO de ink-ms-subscriptions. */

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
export type EstadoSuscripcion = 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';
export type TipoPago = 'SUSCRIPCION' | 'EVENTO';

/** GET /api/planes (PlanResponse) */
export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  limiteEventosMes: number | null;
  porcentajeComision: number | null;
  duracionDias: number;
  activo: boolean;
  beneficios: string[];
}

/** Cuerpo de POST /api/suscripciones y POST /api/suscripciones/{id}/renovar */
export interface CrearSuscripcionRequest {
  planId: number;
  renovacionAutomatica?: boolean;
}

/** Respuesta al iniciar un cobro (PagoCheckoutResponse). */
export interface PagoCheckoutResponse {
  pagoId: number | null;
  monto: number;
  estado: EstadoPago;
  referenciaTransaccion: string | null;
  /** init_point de Mercado Pago; null si el plan era gratuito (ya quedó activo) o si el cobro es con el checkout propio. */
  checkoutUrl: string | null;
}

/** GET /api/suscripciones/actual (SuscripcionResponse) */
export interface SuscripcionResponse {
  id: number;
  organizadorId: string;
  planId: number;
  planNombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoSuscripcion;
  eventosCreadosMes: number;
  limiteEventosMes: number | null;
  renovacionAutomatica: boolean;
  fechaCreacion: string;
}

/** GET /api/suscripciones/{id}/pagos (PagoSuscripcionResponse) */
export interface PagoSuscripcionResponse {
  id: number;
  suscripcionId: number;
  monto: number;
  metodoPago: string | null;
  referenciaTransaccion: string | null;
  estado: EstadoPago;
  fechaPago: string;
  comprobanteId: number | null;
  numeroComprobante: string | null;
}

/**
 * Cuerpo de POST /api/pagos/{referencia}/pagar-tarjeta — checkout propio (sin la
 * interfaz de Mercado Pago). `cardToken` lo genera el SDK JS en el navegador; el
 * número de tarjeta y el CVV nunca pasan por nuestro backend ni por este objeto.
 */
export interface PagoTarjetaRequest {
  cardToken: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string | null;
  docType: string;
  docNumber: string;
}

/** GET /api/pagos/{referencia}/estado (PagoEstadoResponse) */
export interface PagoEstadoResponse {
  referencia: string;
  tipo: TipoPago;
  pagoId: number;
  estado: EstadoPago;
  monto: number;
  /** Solo suscripciones: true si la suscripción ya quedó ACTIVA. Null en eventos. */
  suscripcionActiva: boolean | null;
  /** true si el estado se resolvió re-consultando Mercado Pago en esa misma llamada. */
  reconciliadoAhora: boolean;
}
