import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * M09 - Gestión admin de suscripciones ajenas (RF58, solo ADMIN). Scaffold: pendiente de diseño.
 * Backend ya disponible: PATCH /api/suscripciones/admin/{id}/estado,
 * GET /api/suscripciones/admin/organizadores/{id}/historial (ver SubscriptionService).
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-admin-subscriptions',
  templateUrl: './admin-subscriptions.component.html',
  styleUrl: './admin-subscriptions.component.scss'
})
export class AdminSubscriptionsComponent {}
