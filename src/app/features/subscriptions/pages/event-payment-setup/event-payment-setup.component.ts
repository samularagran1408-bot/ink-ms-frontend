import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

/**
 * M09 - Configurar un evento como pago (RF55, RF63, organizador). Scaffold: pendiente de diseño.
 * Backend ya disponible: POST/PUT/GET /api/eventos-pago/configuracion (ver SubscriptionService
 * .configurarEventoPago / .actualizarConfiguracionEventoPago / .getConfiguracionEventoPago).
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-event-payment-setup',
  templateUrl: './event-payment-setup.component.html',
  styleUrl: './event-payment-setup.component.scss'
})
export class EventPaymentSetupComponent implements OnInit {
  eventoId = '';

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('eventoId') ?? '';
  }
}
