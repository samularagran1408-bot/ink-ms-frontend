import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '@shared/shared.module';
import { PanelRoutingModule } from './panel-routing.module';

/**
 * Area autenticada: layout estable + rutas lazy por pagina.
 * Las paginas se cargan con loadComponent desde PanelRoutingModule.
 */
@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    PanelRoutingModule
  ]
})
export class PanelModule {}
