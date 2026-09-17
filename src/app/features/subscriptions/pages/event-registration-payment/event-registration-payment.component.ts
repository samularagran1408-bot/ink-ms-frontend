import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { SubscriptionService } from '../../services/subscription.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { EventItem } from '@features/sports-disabilities/models/sports';
import { ConfiguracionEventoPagoResponse } from '../../models/subscription-models';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

/**
 * M09 - Resumen de inscripción de pago (RF57). Crea el pago PENDIENTE y lleva al
 * checkout propio de InkluSport (formulario de tarjeta embebido, RF70) — sin
 * redirect a la interfaz de Mercado Pago Checkout Pro.
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
    private readonly confirm: ConfirmDialogService,
  ) {}

  get mostrarCheckout(): boolean {
    return !!this.config?.esPago && (this.config.valorInscripcion ?? 0) > 0;
  }

  get puedePagar(): boolean {
    return this.mostrarCheckout && !this.procesando;
  }

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('eventoId') ?? '';
    if (!this.eventoId) {
      this.error = 'No se indicó el evento a inscribir.';
      this.cargando = false;
      void this.confirm.error({
        title: 'Evento no encontrado',
        message: this.error,
      });
      return;
    }

    this.sports.getEvent(this.eventoId).subscribe({
      next: (evento) => (this.evento = evento),
      error: () => {
        this.error = 'No se pudo cargar la información del evento.';
        void this.confirm.error({ title: 'Error', message: this.error! });
      },
    });

    this.subscriptions.getConfiguracionEventoPago(this.eventoId).subscribe({
      next: (config) => {
        this.config = config;
        this.cargando = false;
        if (!config.esPago) {
          this.error = 'Este evento no requiere pago de inscripción.';
          void this.confirm.info({
            title: 'Evento gratuito',
            message: 'Este evento no tiene tarifa. Vuelve al catálogo e inscríbete desde ahí.',
            confirmLabel: 'Volver a eventos',
          }).then(() => this.volver());
        }
      },
      error: () => {
        this.error = 'Este evento no tiene una tarifa de inscripción configurada.';
        this.cargando = false;
        void this.confirm.warning({
          title: 'Sin tarifa configurada',
          message: this.error!,
          variant: 'ack',
          confirmLabel: 'Volver',
        }).then(() => this.volver());
      },
    });
  }

  async pagar(): Promise<void> {
    if (!this.puedePagar || !this.config || !this.evento) {
      return;
    }

    const monto = this.config.valorInscripcion ?? 0;
    const ok = await this.confirm.ask({
      title: 'Continuar al pago',
      message:
        `Vas a pagar ${monto.toLocaleString('es-CO')} COP por “${this.evento.name}” ` +
        'con el checkout de InkluSport (tarjeta). La inscripción se confirma al aprobar el cobro.',
      confirmLabel: 'Ir al checkout',
      cancelLabel: 'Cancelar',
      tone: 'primary',
    });
    if (!ok) {
      return;
    }

    this.procesando = true;
    this.error = null;

    this.subscriptions.inscribirseEvento(this.eventoId).subscribe({
      next: (resp) => {
        this.procesando = false;
        if (!resp.referenciaTransaccion) {
          this.error = 'No se generó la referencia de pago.';
          void this.confirm.error({ title: 'No se pudo iniciar el pago', message: this.error });
          return;
        }
        void this.router.navigate(['/home/eventos/checkout', resp.referenciaTransaccion], {
          state: {
            monto: resp.monto,
            eventoNombre: this.evento?.name ?? null,
            eventoId: this.eventoId,
          },
        });
      },
      error: (err) => {
        this.procesando = false;
        this.error = err?.error?.message ?? err?.error?.detail ?? 'No se pudo iniciar el pago. Intenta de nuevo.';
        void this.confirm.error({
          title: 'No se pudo iniciar el pago',
          message: this.error!,
        });
      },
    });
  }

  volver(): void {
    void this.router.navigate(['/home/events']);
  }
}
