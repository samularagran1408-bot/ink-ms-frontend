import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-payment-result',
  template: `
    <section class="result">
      <h1>{{ titulo }}</h1>
      <p>{{ mensaje }}</p>
      <p *ngIf="referencia">Referencia: {{ referencia }}</p>
      <button type="button" (click)="irHistorial()">Ver historial de pagos</button>
      <button type="button" (click)="irPanel()">Volver al panel</button>
    </section>
  `,
  styles: [`
    .result { max-width: 560px; margin: 48px auto; padding: 32px; text-align: center; }
    button { margin: 8px; padding: 10px 16px; }
  `]
})
export class PaymentResultComponent implements OnInit {
  status: 'exito' | 'pendiente' | 'error' = 'exito';
  referencia: string | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.status = (this.route.snapshot.data['status'] as 'exito' | 'pendiente' | 'error') || 'exito';
    this.referencia = this.route.snapshot.queryParamMap.get('external_reference')
      || this.route.snapshot.queryParamMap.get('ref');
  }

  get titulo(): string {
    if (this.status === 'pendiente') {
      return 'Pago pendiente';
    }
    if (this.status === 'error') {
      return 'No se pudo completar el pago';
    }
    return 'Pago aprobado';
  }

  get mensaje(): string {
    if (this.status === 'pendiente') {
      return 'Mercado Pago está confirmando tu cobro en COP. Te avisaremos cuando quede aprobado.';
    }
    if (this.status === 'error') {
      return 'El checkout se canceló o fue rechazado. Puedes reintentar desde tu plan o el evento.';
    }
    return 'El cobro se registró. Si compraste un plan, ya debería aparecer activo. Si pagaste un evento, tu inscripción se confirma al aprobar el pago.';
  }

  irHistorial(): void {
    void this.router.navigate(['/organizer/payments']);
  }

  irPanel(): void {
    void this.router.navigate(['/organizer']);
  }
}
