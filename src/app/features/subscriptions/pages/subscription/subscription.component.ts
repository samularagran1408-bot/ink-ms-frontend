import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionService } from '../../services/subscription.service';
import { Plan, SuscripcionResponse } from '../../models/subscription-models';

/** M09 - Estado de la suscripción vigente del organizador (RF57). */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  suscripcion: SuscripcionResponse | null = null;
  planes: Plan[] = [];
  cargando = true;
  error: string | null = null;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (s) => {
        this.suscripcion = s;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        if (err?.status !== 404) {
          this.error = 'No se pudo cargar tu suscripción.';
        }
      },
    });

    this.subscriptions.getPlanes().subscribe({
      next: (planes) => (this.planes = planes),
      error: () => (this.planes = []),
    });
  }

  get eventosUsadosPct(): number {
    if (!this.suscripcion?.limiteEventosMes) {
      return 0;
    }
    return Math.min(100, Math.round((this.suscripcion.eventosCreadosMes / this.suscripcion.limiteEventosMes) * 100));
  }

  renovar(): void {
    if (!this.suscripcion) {
      return;
    }
    this.subscriptions.renovarSuscripcion(this.suscripcion.id).subscribe({
      next: () => this.ngOnInit(),
      error: (err) => (this.error = err?.error?.message ?? 'No se pudo renovar la suscripción.'),
    });
  }

  cambiarPlan(): void {
    this.router.navigate(['/organizer/plans']);
  }
}
