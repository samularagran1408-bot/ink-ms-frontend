import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { Plan, Suscripcion } from '../../models/subscriptions';
import { SubscriptionsService } from '../../services/subscriptions.service';

/** M09 - Estado de la suscripción vigente del organizador (RF57). */
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
    const plan = this.planes.find((item) => item.id === (planId ?? this.actual?.planId));
    this.subscriptions.renovar(this.actual.id, planId).subscribe({
      next: (checkout) => {
        this.renovando = false;
        if (!checkout.referenciaTransaccion) {
          void this.router.navigate(['/organizer/subscription']);
          return;
        }
        void this.router.navigate(['/organizer/plans/pago', checkout.referenciaTransaccion], {
          state: {
            plan: plan ?? {
              id: planId ?? this.actual!.planId,
              nombre: this.actual?.planNombre ?? 'Plan',
              precio: checkout.monto
            } as Plan,
            monto: checkout.monto
          }
        });
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
