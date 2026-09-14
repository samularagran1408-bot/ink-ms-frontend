import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { PaymentsService } from '../../services/payments.service';
import { SubscriptionsService } from '../../services/subscriptions.service';

import { SubscriptionService } from '../../services/subscription.service';
import { PagoEstadoResponse, PagoSuscripcionResponse, Plan } from '../../models/subscription-models';

/** M09 - Comprobante de pago (RF67, RF68): resumen del cobro tras pagar con Mercado Pago. */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-proof-of-payment',
  templateUrl: './proof-of-payment.component.html',
  styleUrl: './proof-of-payment.component.scss'
})
export class ProofOfPaymentComponent implements OnInit {
  pagoId: number | null = null;
  tipo: 'evento' | 'suscripcion' = 'evento';
  referencia: string | null = null;
  plan: string | null = null;
  errorMessage: string | null = null;
  descargando = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private payments: PaymentsService,
    private subscriptions: SubscriptionsService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const id = params.get('pagoId') || params.get('payment_id');
    this.pagoId = id ? Number(id) : null;
    this.tipo = params.get('tipo') === 'suscripcion' ? 'suscripcion' : 'evento';
    this.referencia = params.get('ref') || params.get('external_reference');
    this.plan = params.get('plan');
  }

  descargar(): void {
    if (!this.pagoId || this.descargando) {
      return;
    }
    this.descargando = true;
    const request$ = this.tipo === 'suscripcion'
      ? this.subscriptions.descargarComprobanteSuscripcion(this.pagoId)
      : this.payments.descargarComprobanteEvento(this.pagoId);
    request$.subscribe({
      next: (blob) => {
        this.descargando = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${this.pagoId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.descargando = false;
        this.errorMessage = 'El comprobante aún no está disponible. Si acabas de pagar, espera unos segundos.';
      }
    });
  }

  irAlPanel(): void {
    void this.router.navigate(['/organizer']);
  }
}
