import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * M09 - Historial de pagos de eventos del usuario (RF57, RF68). Scaffold: pendiente de diseño.
 * Backend ya disponible: GET /api/pagos/eventos/historial, GET /api/pagos/eventos/{pagoId}/comprobante
 * (ver SubscriptionService.getHistorialPagosEventos / .descargarComprobanteEvento).
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-event-payment-history',
  templateUrl: './event-payment-history.component.html',
  styleUrl: './event-payment-history.component.scss'
})
export class EventPaymentHistoryComponent {}
