import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SharedModule } from '@shared/shared.module';

import { SubscriptionService } from '../../services/subscription.service';
import { Plan, SuscripcionResponse } from '../../models/subscription-models';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

/**
 * M09 - Catálogo de planes y contratación (RF54, RF56). El cobro de un plan pago se
 * hace con el checkout propio (RF70, `PaymentGatewayComponent`) en vez de redirigir a
 * la interfaz de Mercado Pago: el backend ya no devuelve `checkoutUrl` para pagos de
 * suscripción (ver `PagoSuscripcionService.iniciarPago`), solo una `referenciaTransaccion`
 * con la que se navega al formulario de tarjeta embebido.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  selector: 'app-organizer-plans',
  templateUrl: './organizer-plans.component.html',
  styleUrl: './organizer-plans.component.scss',
})
export class OrganizerPlansComponent implements OnInit {
  planes: Plan[] = [];
  actual: SuscripcionResponse | null = null;
  loading = true;
  errorMessage: string | null = null;
  contratandoId: number | null = null;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly router: Router,
    private readonly confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.getPlanes().subscribe({
      next: (planes) => {
        this.planes = planes;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message
          || (error?.status === 404
            ? 'El catálogo de planes no está disponible. Reconstruye gateway y subscriptions.'
            : 'No se pudieron cargar los planes.');
        this.loading = false;
        void this.confirm.error({
          title: 'No se pudieron cargar los planes',
          message: this.errorMessage!,
        });
      }
    });
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (actual) => (this.actual = actual),
      error: () => (this.actual = null)
    });
  }

  esGratuito(plan: Plan): boolean {
    return plan.esGratuito;
  }

  esPlanActual(plan: Plan): boolean {
    return this.actual?.planId === plan.id && this.actual?.estado === 'ACTIVA';
  }

  precio(plan: Plan): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
      .format(plan.precio ?? 0);
  }

  async elegir(plan: Plan): Promise<void> {
    if (this.esPlanActual(plan) || this.contratandoId) {
      return;
    }
    const ok = await this.confirm.ask({
      title: this.esGratuito(plan) ? 'Activar plan gratuito' : 'Contratar plan',
      message: this.esGratuito(plan)
        ? `¿Activar el plan “${plan.nombre}”?`
        : `¿Contratar “${plan.nombre}” por ${this.precio(plan)}? Continuarás al checkout.`,
      confirmLabel: this.esGratuito(plan) ? 'Activar' : 'Continuar al pago',
      cancelLabel: 'Cancelar',
    });
    if (!ok) {
      return;
    }
    this.contratandoId = plan.id;
    this.errorMessage = null;
    const request$ = this.actual
      ? this.subscriptions.renovarSuscripcion(this.actual.id, plan.id)
      : this.subscriptions.crearSuscripcion({ planId: plan.id });
    request$.subscribe({
      next: (checkout) => {
        this.contratandoId = null;
        if (!checkout.referenciaTransaccion || checkout.estado === 'APROBADO') {
          void this.confirm.ack({
            title: 'Plan activado',
            message: `El plan “${plan.nombre}” quedó activo.`,
          }).then(() => this.router.navigate(['/organizer/subscription']));
          return;
        }
        void this.router.navigate(['/organizer/plans/pago', checkout.referenciaTransaccion], {
          state: { plan, monto: checkout.monto },
        });
      },
      error: (error) => {
        this.contratandoId = null;
        this.errorMessage = error?.error?.message || 'No se pudo iniciar el pago del plan.';
        void this.confirm.error({
          title: 'No se pudo contratar',
          message: this.errorMessage!,
        });
      }
    });
  }
}
