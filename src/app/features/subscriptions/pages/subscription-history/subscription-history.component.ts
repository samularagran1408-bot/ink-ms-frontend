import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionService } from '../../services/subscription.service';
import { HistorialSuscripcionResponse, SuscripcionResponse } from '../../models/subscription-models';

/**
 * M09 - Historial de movimientos de mi suscripción (RF61). Distinto del historial de
 * PAGOS (payment-history): esto es la línea de tiempo de creación/renovación/cambio
 * de plan/cancelación.
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-subscription-history',
  templateUrl: './subscription-history.component.html',
  styleUrl: './subscription-history.component.scss'
})
export class SubscriptionHistoryComponent implements OnInit {
  suscripcion: SuscripcionResponse | null = null;
  movimientos: HistorialSuscripcionResponse[] = [];
  cargando = true;
  error: string | null = null;
  orden: 'asc' | 'desc' = 'desc';

  constructor(private readonly subscriptions: SubscriptionService) {}

  ngOnInit(): void {
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (s) => {
        this.suscripcion = s;
        this.subscriptions.getHistorialSuscripcion(s.id).subscribe({
          next: (movimientos) => {
            this.movimientos = movimientos;
            this.cargando = false;
          },
          error: () => {
            this.error = 'No se pudo cargar el historial de movimientos.';
            this.cargando = false;
          },
        });
      },
      error: (err) => {
        this.cargando = false;
        if (err?.status !== 404) {
          this.error = 'No se pudo cargar tu suscripción.';
        }
      },
    });
  }

  get movimientosOrdenados(): HistorialSuscripcionResponse[] {
    const signo = this.orden === 'desc' ? -1 : 1;
    return [...this.movimientos].sort(
      (a, b) => signo * (new Date(a.fechaMovimiento).getTime() - new Date(b.fechaMovimiento).getTime()),
    );
  }
}
