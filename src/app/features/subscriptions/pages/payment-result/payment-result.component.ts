import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { SubscriptionService } from '../../services/subscription.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.scss'
})
export class PaymentResultComponent implements OnInit {
  status: 'exito' | 'pendiente' | 'error' = 'exito';
  referencia: string | null = null;
  verificando = false;
  private dialogShown = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private subscriptions: SubscriptionService,
    private confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    // Mercado Pago decide a cuál de las 3 back_urls redirige según cómo terminó el
    // checkout, pero eso solo refleja lo que el navegador del usuario vio en ese
    // instante (y con localhost, sin auto_return, ni siquiera es automático). El
    // estado real solo lo tiene el backend, así que esto es solo el estado inicial
    // mientras se reconcilia contra la API.
    this.status = (this.route.snapshot.data['status'] as 'exito' | 'pendiente' | 'error') || 'exito';

    const qp = this.route.snapshot.queryParamMap;
    this.referencia = qp.get('external_reference') || qp.get('ref');
    const paymentId = qp.get('payment_id') || qp.get('collection_id') || qp.get('pagoId');

    if (!this.referencia) {
      this.mostrarDialogoResultado();
      return;
    }

    this.verificando = true;
    this.subscriptions.consultarEstadoPago(this.referencia, paymentId).subscribe({
      next: (r) => {
        this.verificando = false;
        if (r.estado === 'APROBADO') {
          this.status = 'exito';
        } else if (r.estado === 'RECHAZADO' || r.estado === 'CANCELADO') {
          this.status = 'error';
        } else {
          this.status = 'pendiente';
        }
        this.mostrarDialogoResultado();
      },
      error: () => {
        // Sin conexión con el backend: se deja el estado que sugería la URL de
        // Mercado Pago en lugar de bloquear la página.
        this.verificando = false;
        this.mostrarDialogoResultado();
      },
    });
  }

  private mostrarDialogoResultado(): void {
    if (this.dialogShown) {
      return;
    }
    this.dialogShown = true;
    if (this.status === 'exito') {
      void this.confirm.ack({
        title: this.titulo,
        message: this.mensaje,
      });
      return;
    }
    if (this.status === 'pendiente') {
      void this.confirm.info({
        title: this.titulo,
        message: this.mensaje,
      });
      return;
    }
    void this.confirm.error({
      title: this.titulo,
      message: this.mensaje,
    });
  }

  get titulo(): string {
    if (this.status === 'pendiente') {
      return 'Pago pendiente';
    }
    if (this.status === 'error') {
      return 'No se pudo completar el pago';
    }
    return 'Pago aprobado';
  }

  get mensaje(): string {
    if (this.status === 'pendiente') {
      return 'Mercado Pago está confirmando tu cobro en COP. Te avisaremos cuando quede aprobado.';
    }
    if (this.status === 'error') {
      return 'El checkout se canceló o fue rechazado. Puedes reintentar desde tu plan o el evento.';
    }
    return 'El cobro se registró. Si compraste un plan, ya debería aparecer activo. Si pagaste un evento, tu inscripción se confirma al aprobar el pago.';
  }

  irHistorial(): void {
    void this.router.navigate(['/home/pagos-eventos'], {
      queryParams: { refreshed: Date.now() },
    });
  }

  irPanel(): void {
    void this.router.navigate(['/home/events']);
  }
}
