import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { Plan, Suscripcion } from '../../models/subscriptions';
import { CheckoutRedirectService } from '../../services/checkout-redirect.service';
import { SubscriptionsService } from '../../services/subscriptions.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  actual: Suscripcion | null = null;
  planes: Plan[] = [];
  loading = true;
  errorMessage: string | null = null;
  renovando = false;

  constructor(
    private subscriptions: SubscriptionsService,
    private checkout: CheckoutRedirectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.listarPlanes().subscribe({
      next: (planes) => (this.planes = planes)
    });
    this.subscriptions.obtenerActual().subscribe({
      next: (actual) => {
        this.actual = actual;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Aún no tienes una suscripción activa.';
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

  renovar(planId?: number): void {
    if (!this.actual || this.renovando) {
      return;
    }
    this.renovando = true;
    this.subscriptions.renovar(this.actual.id, planId).subscribe({
      next: (checkout) => {
        this.renovando = false;
        this.checkout.follow(checkout, { plan: this.actual?.planNombre });
      },
      error: (error) => {
        this.renovando = false;
        this.errorMessage = error?.error?.message || 'No se pudo renovar la suscripción.';
      }
    });
  }

  irAPlanes(): void {
    void this.router.navigate(['/organizer/plans']);
  }
}
