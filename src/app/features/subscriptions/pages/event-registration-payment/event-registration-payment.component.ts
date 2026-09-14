import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

/**
 * M09 - Pago de inscripción a un evento pago (RF57, usuario/atleta). Scaffold: pendiente de diseño.
 * Backend ya disponible: POST /api/pagos/eventos/{eventoId}/inscripcion (Checkout Pro,
 * redirect a Mercado Pago — no usa el checkout propio con tarjeta que sí tienen las
 * suscripciones). Ver SubscriptionService.inscribirseEvento.
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-event-registration-payment',
  templateUrl: './event-registration-payment.component.html',
  styleUrl: './event-registration-payment.component.scss'
})
export class EventRegistrationPaymentComponent implements OnInit {
  eventoId = '';

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('eventoId') ?? '';
  }
}
