import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SubscriptionService } from '../../services/subscription.service';
import { PagoEventoResponse } from '../../models/subscription-models';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

/** M09 - Historial de pagos de inscripción a eventos del usuario (RF57, RF68). */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-event-payment-history',
  templateUrl: './event-payment-history.component.html',
  styleUrl: './event-payment-history.component.scss'
})
export class EventPaymentHistoryComponent implements OnInit {
  pagos: PagoEventoResponse[] = [];
  loading = true;
  errorMessage: string | null = null;
  filtro = '';
  descargandoId: number | null = null;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly confirm: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.getHistorialPagosEventos().subscribe({
      next: (pagos) => {
        this.pagos = pagos;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar tu historial de pagos de eventos.';
        this.loading = false;
        void this.confirm.error({
          title: 'Error al cargar',
          message: this.errorMessage!,
        });
      }
    });
  }

  get filtrados(): PagoEventoResponse[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) {
      return this.pagos;
    }
    return this.pagos.filter((p) =>
      String(p.id).includes(q) ||
      (p.nombreEvento ?? '').toLowerCase().includes(q) ||
      p.eventoId.toLowerCase().includes(q) ||
      p.estado.toLowerCase().includes(q));
  }

  totalAprobado(): number {
    return this.pagos.filter((p) => p.estado === 'APROBADO').reduce((sum, p) => sum + (p.monto || 0), 0);
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

  nombreEvento(pago: PagoEventoResponse): string {
    return pago.nombreEvento?.trim() || `Evento ${pago.eventoId}`;
  }

  descargar(pago: PagoEventoResponse): void {
    if (!pago.comprobanteId || this.descargandoId) {
      return;
    }
    this.descargandoId = pago.id;
    this.subscriptions.descargarComprobanteEvento(pago.id).subscribe({
      next: (blob) => {
        this.descargandoId = null;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-evento-${pago.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        void this.confirm.ack({
          title: 'Comprobante descargado',
          message: `Se descargó el comprobante del pago #${pago.id}.`,
        });
      },
      error: () => {
        this.descargandoId = null;
        this.errorMessage = 'El comprobante aún no está disponible. Intenta de nuevo en unos segundos.';
        void this.confirm.warning({
          title: 'Comprobante no disponible',
          message: this.errorMessage!,
          variant: 'ack',
        });
      }
    });
  }
}
