import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { AssistantPageComponent } from './pages/assistant-page/assistant-page.component';
import { TrainerDashboardComponent } from './pages/trainer-dashboard/trainer-dashboard.component';
import { SessionsPageComponent } from './pages/sessions-page/sessions-page.component';
import { CrewPageComponent } from './pages/crew-page/crew-page.component';

/**
 * M08 - Asistente Virtual Inteligente.
 * Chat del asistente, panel del entrenador (metricas y alertas de riesgo)
 * y rutinas/sesiones de entrenamiento. El widget flotante y el body-map viven
 * en shared/ por tener consumidores fuera de este modulo. Ver features/MODULES.md.
 */
@NgModule({
  declarations: [
    AssistantPageComponent,
    TrainerDashboardComponent,
    SessionsPageComponent,
    CrewPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    AssistantPageComponent,
    TrainerDashboardComponent,
    SessionsPageComponent,
    CrewPageComponent
  ]
})
export class AssistantModule {}
