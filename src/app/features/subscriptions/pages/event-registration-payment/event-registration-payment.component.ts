import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { SubscriptionService } from '../../services/subscription.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { EventItem } from '@features/sports-disabilities/models/sports';
import { ConfiguracionEventoPagoResponse } from '../../models/subscription-models';

/**
 * M09 - Pago de inscripción a un evento pago (RF57, usuario/atleta). Usa Checkout Pro
 * (redirect a Mercado Pago), no el checkout propio con tarjeta que sí tienen las
 * suscripciones — por eso el botón redirige en vez de mostrar un formulario.
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
  evento: EventItem | null = null;
  config: ConfiguracionEventoPagoResponse | null = null;

  cargando = true;
  procesando = false;
  error: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly subscriptions: SubscriptionService,
    private readonly sports: SportsService,
  ) {}

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('eventoId') ?? '';
    if (!this.eventoId) {
      this.error = 'No se indicó el evento a inscribir.';
      this.cargando = false;
      return;
    }

    this.sports.getEvent(this.eventoId).subscribe({
      next: (evento) => (this.evento = evento),
      error: () => (this.error = 'No se pudo cargar la información del evento.'),
    });

    this.subscriptions.getConfiguracionEventoPago(this.eventoId).subscribe({
      next: (config) => {
        this.config = config;
        this.cargando = false;
        if (!config.esPago) {
          this.error = 'Este evento no requiere pago de inscripción.';
        }
      },
      error: () => {
        this.error = 'Este evento no tiene una tarifa de inscripción configurada.';
        this.cargando = false;
      },
    });
  }

  pagar(): void {
    if (!this.config?.esPago || this.procesando) {
      return;
    }
    this.procesando = true;
    this.error = null;

    this.subscriptions.inscribirseEvento(this.eventoId).subscribe({
      next: (resp) => {
        if (resp.checkoutUrl) {
          window.location.href = resp.checkoutUrl;
          return;
        }
        this.procesando = false;
        this.router.navigate(['/home/pagos-eventos']);
      },
      error: (err) => {
        this.procesando = false;
        this.error = err?.error?.message ?? 'No se pudo iniciar el pago. Intenta de nuevo.';
      },
    });
  }

  volver(): void {
    this.router.navigate(['/home/events']);
  }
}
