import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@shared/shared.module';

import { Plan, Suscripcion } from '../../models/subscriptions';
import { CheckoutRedirectService } from '../../services/checkout-redirect.service';
import { SubscriptionsService } from '../../services/subscriptions.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  selector: 'app-organizer-plans',
  templateUrl: './organizer-plans.component.html',
  styleUrl: './organizer-plans.component.scss'
})
export class OrganizerPlansComponent implements OnInit {
  planes: Plan[] = [];
  actual: Suscripcion | null = null;
  loading = true;
  errorMessage: string | null = null;
  contratandoId: number | null = null;

  constructor(
    private subscriptions: SubscriptionsService,
    private checkout: CheckoutRedirectService
  ) {}

  ngOnInit(): void {
    this.subscriptions.listarPlanes().subscribe({
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
      }
    });
    this.subscriptions.obtenerActual().subscribe({
      next: (actual) => (this.actual = actual),
      error: () => (this.actual = null)
    });
  }

  esPlanActual(plan: Plan): boolean {
    return this.actual?.planId === plan.id && this.actual?.estado === 'ACTIVA';
  }

  precio(plan: Plan): string {
    const moneda = plan.moneda || 'COP';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 })
      .format(plan.precio ?? 0);
  }

  elegir(plan: Plan): void {
    if (this.esPlanActual(plan) || this.contratandoId) {
      return;
    }
    this.contratandoId = plan.id;
    this.errorMessage = null;
    const request$ = this.actual
      ? this.subscriptions.renovar(this.actual.id, plan.id)
      : this.subscriptions.contratar(plan.id);
    request$.subscribe({
      next: (checkout) => {
        this.contratandoId = null;
        this.checkout.follow(checkout, { plan: plan.nombre });
      },
      error: (error) => {
        this.contratandoId = null;
        this.errorMessage = error?.error?.message || 'No se pudo iniciar el pago con Mercado Pago.';
      }
    });
  }
}
