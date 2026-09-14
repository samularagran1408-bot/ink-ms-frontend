import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SubscriptionService } from '../../services/subscription.service';
import { PagoSuscripcionResponse, SuscripcionResponse } from '../../models/subscription-models';

/** M09 - Historial de pagos de la suscripción del organizador (RF61, RF66). */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss'
})
export class PaymentHistoryComponent implements OnInit {
  suscripcion: SuscripcionResponse | null = null;
  pagos: PagoSuscripcionResponse[] = [];
  cargando = true;
  error: string | null = null;
  busqueda = '';

  constructor(private readonly subscriptions: SubscriptionService) {}

  ngOnInit(): void {
    this.subscriptions.getSuscripcionActual().subscribe({
      next: (s) => {
        this.suscripcion = s;
        this.subscriptions.getPagosSuscripcion(s.id).subscribe({
          next: (pagos) => {
            this.pagos = pagos;
            this.cargando = false;
          },
          error: () => {
            this.error = 'No se pudo cargar el historial de pagos.';
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

  get pagosFiltrados(): PagoSuscripcionResponse[] {
    const texto = this.busqueda.trim().toLowerCase();
    if (!texto) {
      return this.pagos;
    }
    return this.pagos.filter((p) => (p.referenciaTransaccion ?? '').toLowerCase().includes(texto));
  }

  get totalInvertido(): number {
    return this.pagos.filter((p) => p.estado === 'APROBADO').reduce((sum, p) => sum + p.monto, 0);
  }

  get ultimoPagoAprobado(): PagoSuscripcionResponse | null {
    const aprobados = this.pagos.filter((p) => p.estado === 'APROBADO');
    if (!aprobados.length) {
      return null;
    }
    return aprobados.reduce((a, b) => (new Date(a.fechaPago) > new Date(b.fechaPago) ? a : b));
  }

  badgeClass(estado: string): string {
    if (estado === 'APROBADO') return 'b-ok';
    if (estado === 'RECHAZADO') return 'b-err';
    return 'b-warn';
  }

  /** Exporta el historial cargado (ya filtrado) a un CSV real, generado en el navegador. */
  exportarCsv(): void {
    const filas = this.pagosFiltrados;
    const encabezado = ['Referencia', 'Fecha', 'Metodo', 'Monto', 'Estado', 'Comprobante'];
    const lineas = filas.map((p) => [
      p.referenciaTransaccion ?? '',
      p.fechaPago,
      p.metodoPago ?? '',
      p.monto.toFixed(2),
      p.estado,
      p.numeroComprobante ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [encabezado.join(','), ...lineas].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historial-pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
