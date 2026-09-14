import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
<<<<<<< Updated upstream
=======
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { OrganizerPlansComponent } from './pages/organizer-plans/organizer-plans.component';
import { PaymentHistoryComponent } from './pages/payment-history/payment-history.component';
import { SubscriptionComponent } from './pages/subscription/subscription.component';
import { ProofOfPaymentComponent } from './pages/proof-of-payment/proof-of-payment.component';
import { PaymentGatewayComponent } from './pages/payment-gateway/payment-gateway.component';
>>>>>>> Stashed changes

/**
 * M09 - Suscripciones.
 * Las paginas son standalone y se cargan por ruta. Ver README.md (RF54-RF68).
 */
@NgModule({
<<<<<<< Updated upstream
  imports: [CommonModule]
=======
  declarations: [
    OrganizerPlansComponent,
    PaymentHistoryComponent,
    SubscriptionComponent,
    ProofOfPaymentComponent,
    PaymentGatewayComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    OrganizerPlansComponent,
    PaymentHistoryComponent,
    SubscriptionComponent,
    ProofOfPaymentComponent,
    PaymentGatewayComponent
  ]
>>>>>>> Stashed changes
})
export class SubscriptionsModule {}
