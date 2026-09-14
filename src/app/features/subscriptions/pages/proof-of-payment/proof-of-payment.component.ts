import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionService } from '../../services/subscription.service';
import { PagoEstadoResponse, PagoSuscripcionResponse, Plan } from '../../models/subscription-models';

/** M09 - Comprobante de pago (RF67, RF68): resumen del cobro tras pagar con Mercado Pago. */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-proof-of-payment',
  templateUrl: './proof-of-payment.component.html',
  styleUrl: './proof-of-payment.component.scss'
})
export class ProofOfPaymentComponent implements OnInit {
  referencia = '';
  estado: PagoEstadoResponse | null = null;
  pago: PagoSuscripcionResponse | null = null;
  plan: Plan | null = null;
  cargando = true;
  error: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly subscriptions: SubscriptionService,
  ) {}

  ngOnInit(): void {
    const state = history.state as { referencia?: string } | undefined;
    this.referencia = this.route.snapshot.queryParamMap.get('ref') ?? state?.referencia ?? '';

    if (!this.referencia) {
      this.error = 'No se encontró información de ningún pago reciente.';
      this.cargando = false;
      return;
    }

    this.subscriptions.consultarEstadoPago(this.referencia).subscribe({
      next: (estado) => {
        this.estado = estado;
        this.cargarDetalle();
      },
      error: () => {
        this.error = 'No se encontró este pago.';
        this.cargando = false;
      },
    });
  }

  private cargarDetalle(): void {
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (suscripcion) => {
        this.subscriptions.getPagosSuscripcion(suscripcion.id).subscribe({
          next: (pagos) => {
            this.pago = pagos.find((p) => p.referenciaTransaccion === this.referencia) ?? null;
            this.subscriptions.getPlanes().subscribe({
              next: (planes) => {
                this.plan = planes.find((p) => p.id === suscripcion.planId) ?? null;
                this.cargando = false;
              },
              error: () => (this.cargando = false),
            });
          },
          error: () => (this.cargando = false),
        });
      },
      error: () => (this.cargando = false),
    });
  }

  irAPanel(): void {
    this.router.navigate(['/organizer/subscription']);
  }

  imprimir(): void {
    window.print();
  }
}
