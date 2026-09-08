import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { OrganizerPlansComponent } from './pages/organizer-plans/organizer-plans.component';

/**
 * M09 - Suscripciones.
 *
 * Hogar previsto para planes de suscripcion, pasarela de pago, eventos
 * pagos, limites de plan, renovaciones, comprobantes y reportes
 * financieros. Ver README.md (RF54-RF68).
 */
@NgModule({
  declarations: [
    OrganizerPlansComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    OrganizerPlansComponent
  ]
})
export class SubscriptionsModule {}
