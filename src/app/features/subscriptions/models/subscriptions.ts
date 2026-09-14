/** Contratos de ink-ms-subscriptions. */

export type EstadoSuscripcion = 'ACTIVA' | 'SUSPENDIDA' | 'VENCIDA' | 'CANCELADA';
export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO' | 'REEMBOLSADO';

export interface Plan {
  id: number;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  moneda?: string | null;
  limiteEventosMes?: number | null;
  porcentajeComision?: number | null;
  duracionDias?: number | null;
  activo?: boolean;
  esGratuito?: boolean;
  esPlanInicial?: boolean;
  beneficios?: string[] | null;
  funcionalidades?: string[] | null;
}

export interface Suscripcion {
  id: number;
  organizadorId: string;
  planId: number;
  planNombre: string;
  precioAplicado: number;
  limiteEventosAplicado?: number | null;
  porcentajeComisionAplicado?: number | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoSuscripcion;
  eventosCreadosMes?: number | null;
  limiteEventosMes?: number | null;
  renovacionAutomatica?: boolean | null;
  fechaCreacion?: string | null;
}

export interface PagoCheckout {
  pagoId: number | null;
  monto: number;
  estado: EstadoPago;
  referenciaTransaccion?: string | null;
  checkoutUrl?: string | null;
}

export interface PagoSuscripcion {
  id: number;
  suscripcionId: number;
  monto: number;
  metodoPago?: string | null;
  referenciaTransaccion?: string | null;
  estado: EstadoPago;
  fechaPago?: string | null;
  comprobanteId?: number | null;
  numeroComprobante?: string | null;
}

export interface PagoEvento {
  id: number;
  usuarioId: string;
  eventoId: string;
  monto: number;
  metodoPago?: string | null;
  referenciaTransaccion?: string | null;
  estado: EstadoPago;
  fechaPago?: string | null;
  comprobanteId?: number | null;
  numeroComprobante?: string | null;
}

export interface EventoPagoConfig {
  id?: number;
  eventoId?: string;
  organizadorId?: string;
  esPago: boolean;
  valorInscripcion?: number | null;
  porcentajeComision?: number | null;
}
