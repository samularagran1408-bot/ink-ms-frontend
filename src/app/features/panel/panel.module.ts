import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '@shared/shared.module';
import { PanelRoutingModule } from './panel-routing.module';

// Feature modules por modulo de producto (M02-M09). Cada uno declara y exporta
// sus paginas; PanelRoutingModule las referencia en sus rutas por rol
// (/admin, /trainer, /organizer, /home). Ver features/MODULES.md.
import { UsersModule } from '@features/users/users.module';
import { SportsDisabilitiesModule } from '@features/sports-disabilities/sports-disabilities.module';
import { AccessibilityModule } from '@features/accessibility/accessibility.module';
import { AdminModule } from '@features/admin/admin.module';
import { ReportsModule } from '@features/reports/reports.module';
import { AssistantModule } from '@features/assistant/assistant.module';
import { SearchModule } from '@features/search/search.module';
import { SubscriptionsModule } from '@features/subscriptions/subscriptions.module';

/**
 * Raiz de composicion del area autenticada. No declara paginas: solo compone
 * los feature modules y mantiene el enrutado por rol (PanelRoutingModule).
 * El layout `app-panel-shell` vive en SharedModule.
 */
@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    UsersModule,
    SportsDisabilitiesModule,
    AccessibilityModule,
    AdminModule,
    ReportsModule,
    AssistantModule,
    SearchModule,
    SubscriptionsModule,
    PanelRoutingModule
  ]
})
export class PanelModule {}
