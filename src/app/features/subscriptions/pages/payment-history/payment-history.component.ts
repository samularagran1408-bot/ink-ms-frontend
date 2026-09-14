import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { PagoEvento, PagoSuscripcion } from '../../models/subscriptions';
import { PaymentsService } from '../../services/payments.service';
import { SubscriptionsService } from '../../services/subscriptions.service';

interface LedgerRow {
  id: number;
  tipo: 'suscripcion' | 'evento';
  concepto: string;
  fecha?: string | null;
  metodo?: string | null;
  monto: number;
  estado: string;
  comprobanteId?: number | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss'
})
export class PaymentHistoryComponent implements OnInit {
  rows: LedgerRow[] = [];
  loading = true;
  errorMessage: string | null = null;
  filtro = '';

  constructor(
    private subscriptions: SubscriptionsService,
    private payments: PaymentsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.obtenerActual().pipe(
      switchMap((actual) =>
        forkJoin({
          suscripcion: this.subscriptions.listarPagos(actual.id).pipe(catchError(() => of([] as PagoSuscripcion[]))),
          eventos: this.payments.historialEventos().pipe(catchError(() => of([] as PagoEvento[])))
        })
      ),
      catchError(() =>
        forkJoin({
          suscripcion: of([] as PagoSuscripcion[]),
          eventos: this.payments.historialEventos().pipe(catchError(() => of([] as PagoEvento[])))
        })
      )
    ).subscribe({
      next: ({ suscripcion, eventos }) => {
        const subRows: LedgerRow[] = suscripcion.map((p) => ({
          id: p.id,
          tipo: 'suscripcion',
          concepto: 'Suscripción de organizador',
          fecha: p.fechaPago,
          metodo: p.metodoPago,
          monto: p.monto,
          estado: p.estado,
          comprobanteId: p.comprobanteId
        }));
        const eventRows: LedgerRow[] = eventos.map((p) => ({
          id: p.id,
          tipo: 'evento',
          concepto: 'Inscripción a evento ' + p.eventoId,
          fecha: p.fechaPago,
          metodo: p.metodoPago,
          monto: p.monto,
          estado: p.estado,
          comprobanteId: p.comprobanteId
        }));
        this.rows = [...subRows, ...eventRows].sort((a, b) =>
          String(b.fecha || '').localeCompare(String(a.fecha || '')));
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el historial de pagos.';
        this.loading = false;
      }
    });
  }

  get filtradas(): LedgerRow[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) {
      return this.rows;
    }
    return this.rows.filter((row) =>
      String(row.id).includes(q) || row.concepto.toLowerCase().includes(q) || row.estado.toLowerCase().includes(q));
  }

  totalAprobado(): number {
    return this.rows.filter((r) => r.estado === 'APROBADO').reduce((sum, r) => sum + (r.monto || 0), 0);
  }

  verComprobante(row: LedgerRow): void {
    void this.router.navigate(['/organizer/payments/receipt'], {
      queryParams: { pagoId: row.id, tipo: row.tipo }
    });
  }

  badge(estado: string): string {
    if (estado === 'APROBADO') {
      return 'b-ok';
    }
    if (estado === 'PENDIENTE') {
      return 'b-warn';
    }
    if (estado === 'REEMBOLSADO') {
      return 'b-ref';
    }
    return 'b-err';
  }
}
