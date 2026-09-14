import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';

import { SubscriptionService } from '../../services/subscription.service';
import { Plan, SuscripcionResponse } from '../../models/subscription-models';

/**
 * M09 - Planes de suscripción (RF54, RF56). Lista los planes reales de
 * ink-ms-subscriptions; al elegir un plan pago navega al checkout propio
 * (RF70, tokenización con el SDK JS de Mercado Pago). Si el plan es gratuito,
 * el backend ya lo activa de inmediato y no hay cobro.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-organizer-plans',
  templateUrl: './organizer-plans.component.html',
  styleUrl: './organizer-plans.component.scss',
})
export class OrganizerPlansComponent implements OnInit {
  planes: Plan[] = [];
  suscripcionActual: SuscripcionResponse | null = null;
  cargando = true;
  error: string | null = null;
  procesandoPlanId: number | null = null;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.subscriptions.getPlanes().subscribe({
      next: (planes) => {
        this.planes = planes;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los planes. Verifica que el servicio de suscripciones esté arriba.';
        this.cargando = false;
      },
    });

    // 404 = el organizador aún no tiene ninguna suscripción; no es un error.
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (s) => (this.suscripcionActual = s),
      error: () => (this.suscripcionActual = null),
    });
  }

  esPlanActual(plan: Plan): boolean {
    return this.suscripcionActual?.planId === plan.id && this.suscripcionActual?.estado === 'ACTIVA';
  }

  suscribirse(plan: Plan): void {
    if (this.procesandoPlanId !== null) {
      return;
    }
    this.procesandoPlanId = plan.id;
    this.error = null;

    const suscripcion = this.suscripcionActual;
    const reutilizable = suscripcion != null && suscripcion.estado !== 'CANCELADA';
    const peticion$ = reutilizable
      ? this.subscriptions.renovarSuscripcion(suscripcion!.id, plan.id)
      : this.subscriptions.crearSuscripcion({ planId: plan.id });

    peticion$.subscribe({
      next: (resp) => {
        this.procesandoPlanId = null;

        if (!resp.referenciaTransaccion) {
          // Plan gratuito: ya quedó activo en el backend, no hay nada que cobrar.
          this.router.navigate(['/organizer/subscription']);
          return;
        }

        // Plan pago: el cobro se completa en nuestra propia vista (checkout embebido
        // con el SDK de Mercado Pago), no en la interfaz de Mercado Pago.
        this.router.navigate(['/organizer/plans/pago', resp.referenciaTransaccion], {
          state: { plan, monto: resp.monto },
        });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo iniciar el pago. Intenta de nuevo.';
        this.procesandoPlanId = null;
      },
    });
  }
}
