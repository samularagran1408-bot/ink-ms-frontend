import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { SubscriptionService } from '../../services/subscription.service';
import { Plan, SuscripcionResponse } from '../../models/subscription-models';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

/**
 * M09 - Estado de la suscripción vigente del organizador (RF57). La renovación usa el
 * checkout propio (RF70, `PaymentGatewayComponent`), no un redirect a la interfaz de
 * Mercado Pago: el backend ya no devuelve `checkoutUrl` para pagos de suscripción.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  actual: SuscripcionResponse | null = null;
  planes: Plan[] = [];
  loading = true;
  errorMessage: string | null = null;
  renovando = false;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly router: Router,
    private readonly confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.getPlanes().subscribe({
      next: (planes) => (this.planes = planes)
    });
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (actual) => {
        this.actual = actual;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Aún no tienes una suscripción activa.';
        void this.confirm.info({
          title: 'Sin suscripción activa',
          message: this.errorMessage!,
        });
      }
    });
  }

  usoEventos(): number {
    const usados = this.actual?.eventosCreadosMes ?? 0;
    const limite = this.actual?.limiteEventosMes ?? 0;
    if (!limite) {
      return 0;
    }
    return Math.min(100, Math.round((usados / limite) * 100));
  }

  async renovar(planId?: number): Promise<void> {
    if (!this.actual || this.renovando) {
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Renovar suscripción',
      message: 'Se iniciará el proceso de pago/renovación de tu plan. ¿Continuar?',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    });
    if (!ok) {
      return;
    }
    this.renovando = true;
    this.errorMessage = null;
    const idPlanDestino = planId ?? this.actual.planId;
    this.subscriptions.renovarSuscripcion(this.actual.id, planId).subscribe({
      next: (checkout) => {
        this.renovando = false;
        if (!checkout.referenciaTransaccion || checkout.estado === 'APROBADO') {
          void this.confirm.ack({
            title: 'Suscripción actualizada',
            message: 'Tu plan quedó activo.',
          }).then(() => this.router.navigate(['/organizer/subscription']));
          return;
        }
        const plan = this.planes.find((p) => p.id === idPlanDestino) ?? null;
        void this.confirm.info({
          title: 'Continuar al pago',
          message: 'Te llevamos al checkout para completar el cobro del plan.',
          confirmLabel: 'Ir al pago',
        }).then(() =>
          this.router.navigate(['/organizer/plans/pago', checkout.referenciaTransaccion], {
            state: { plan, monto: checkout.monto },
          })
        );
      },
      error: (error) => {
        this.renovando = false;
        this.errorMessage = error?.error?.message || 'No se pudo renovar la suscripción.';
        void this.confirm.error({
          title: 'No se pudo renovar',
          message: this.errorMessage!,
        });
      }
    });
  }

  irAPlanes(): void {
    void this.router.navigate(['/organizer/plans']);
  }

  irAHistorial(): void {
    void this.router.navigate(['/organizer/subscription/historial']);
  }
}
