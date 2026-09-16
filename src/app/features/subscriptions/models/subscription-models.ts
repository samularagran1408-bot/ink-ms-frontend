/** M09 - Suscripciones: modelos alineados con los DTO de ink-ms-subscriptions. */

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO' | 'CANCELADO';
export type EstadoSuscripcion = 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';
export type TipoPago = 'SUSCRIPCION' | 'EVENTO';
export type TipoMovimiento =
  | 'ASIGNACION_INICIAL'
  | 'CREACION'
  | 'RENOVACION'
  | 'CAMBIO_PLAN'
  | 'CANCELACION'
  | 'SUSPENSION'
  | 'REACTIVACION'
  | 'VENCIMIENTO';

/** GET /api/planes (PlanResponse) */
export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  limiteEventosMes: number | null;
  porcentajeComision: number | null;
  duracionDias: number;
  activo: boolean;
  esGratuito: boolean;
  esPlanInicial: boolean;
  fechaCreacion: string;
  beneficios: string[];
  funcionalidades: string[];
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
  /** Precio, límite y comisión vigentes al momento de contratar; distintos de los del plan si este cambió después. */
  precioAplicado: number;
  limiteEventosAplicado: number | null;
  porcentajeComisionAplicado: number;
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

// ---------------------------------------------------------------------------
// RF65 - Administración de planes (solo ADMIN)
// ---------------------------------------------------------------------------

/** Cuerpo de POST /api/planes/admin y PUT /api/planes/admin/{id} */
export interface PlanRequest {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  limiteEventosMes: number;
  porcentajeComision: number;
  duracionDias: number;
  beneficios: string[];
  /** Si el plan se activa con precio 0 sin pasar por checkout. */
  esGratuito?: boolean;
  /** El plan que se asigna automáticamente a todo organizador nuevo (solo debería haber uno activo). */
  esPlanInicial?: boolean;
}

// ---------------------------------------------------------------------------
// RF61 - Historial de movimientos de una suscripción (distinto del historial de pagos)
// ---------------------------------------------------------------------------

/** GET /api/suscripciones/{id}/historial (HistorialSuscripcionResponse) */
export interface HistorialSuscripcionResponse {
  id: number;
  suscripcionId: number;
  tipoMovimiento: TipoMovimiento;
  planAnteriorId: number | null;
  planAnteriorNombre: string | null;
  planNuevoId: number;
  planNuevoNombre: string;
  estadoAnterior: EstadoSuscripcion | null;
  estadoNuevo: EstadoSuscripcion | null;
  /** Motivo u observación opcional; solo presente en cambios aplicados por un admin. */
  notas: string | null;
  /** UUID del admin que aplicó el cambio, o null si fue el propio organizador o el sistema. */
  realizadoPor: string | null;
  realizadoPorEmail: string | null;
  fechaMovimiento: string;
}

// ---------------------------------------------------------------------------
// RF58 - Gestión admin de la suscripción de un organizador ajeno
// ---------------------------------------------------------------------------

/** Cuerpo de PATCH /api/suscripciones/admin/{id}/estado */
export interface CambiarEstadoSuscripcionRequest {
  estado: EstadoSuscripcion;
  motivo?: string | null;
}

// ---------------------------------------------------------------------------
// RF55, RF63 - Configuración de un evento como pago
// ---------------------------------------------------------------------------

/** Cuerpo de POST/PUT /api/eventos-pago/configuracion */
export interface ConfiguracionEventoPagoRequest {
  eventoId: string;
  esPago: boolean;
  valorInscripcion?: number | null;
}

/** GET /api/eventos-pago/configuracion(/{eventoId}) (ConfiguracionEventoPagoResponse) */
export interface ConfiguracionEventoPagoResponse {
  id: number;
  eventoId: string;
  organizadorId: string;
  esPago: boolean;
  valorInscripcion: number | null;
  porcentajeComision: number | null;
  fechaCreacion: string;
}

// ---------------------------------------------------------------------------
// RF57 - Inscripción y pago a eventos (checkout Pro, distinto del de suscripciones)
// ---------------------------------------------------------------------------

/** GET /api/pagos/eventos/historial (PagoEventoResponse) */
export interface PagoEventoResponse {
  id: number;
  usuarioId: string;
  eventoId: string;
  monto: number;
  metodoPago: string | null;
  referenciaTransaccion: string | null;
  estado: EstadoPago;
  fechaPago: string;
  comprobanteId: number | null;
  numeroComprobante: string | null;
}

/** GET /api/internal/suscripciones/organizadores/{id}/puede-crear-evento (PuedeCrearEventoResponse) */
export interface PuedeCrearEventoResponse {
  puedeCrear: boolean;
  eventosCreadosMes: number | null;
  limiteEventosMes: number | null;
  planNombre: string | null;
}

// ---------------------------------------------------------------------------
// RF62 - Reportes financieros (organizador propio + admin global)
// ---------------------------------------------------------------------------

export interface ReporteEventoItem {
  eventoId: string;
  numeroInscritos: number;
  montoTotal: number;
  comisionEstimada: number;
}

/** GET /api/reportes/financiero y /api/reportes/admin/financiero (ReporteFinancieroResponse) */
export interface ReporteFinancieroResponse {
  desde: string;
  hasta: string;
  ingresosPorEventos: number;
  ingresosPorSuscripciones: number;
  numeroInscritos: number;
  detallePorEvento: ReporteEventoItem[];
}
