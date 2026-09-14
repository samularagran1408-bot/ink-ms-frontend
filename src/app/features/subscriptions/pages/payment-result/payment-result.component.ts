import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.scss'
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
