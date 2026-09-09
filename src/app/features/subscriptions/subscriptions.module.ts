import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { OrganizerPlansComponent } from './pages/organizer-plans/organizer-plans.component';
import { PaymentHistoryComponent } from './pages/payment-history/payment-history.component';
import { SubscriptionComponent } from './pages/subscription/subscription.component';
import { ProofOfPaymentComponent } from './pages/proof-of-payment/proof-of-payment.component';

/**
 * M09 - Suscripciones.
 *
 * Hogar previsto para planes de suscripcion, pasarela de pago, eventos
 * pagos, limites de plan, renovaciones, comprobantes y reportes
 * financieros. Ver README.md (RF54-RF68).
 */
@NgModule({
  declarations: [
    OrganizerPlansComponent,
    PaymentHistoryComponent,
    SubscriptionComponent,
    ProofOfPaymentComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    OrganizerPlansComponent,
    PaymentHistoryComponent,
    SubscriptionComponent,
    ProofOfPaymentComponent
  ]
})
export class SubscriptionsModule {}
