import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { SportsPageComponent } from './pages/sports-page/sports-page.component';
import { DisabilitiesPageComponent } from './pages/disabilities-page/disabilities-page.component';
import { AssociationsPageComponent } from './pages/associations-page/associations-page.component';
import { EventsPageComponent } from './pages/events-page/events-page.component';
import { OrganizerDashboardComponent } from './pages/organizer-dashboard/organizer-dashboard.component';

/**
 * M03 - Gestion de Deportes y Discapacidades.
 * Catalogo de deportes, tipos de discapacidad, asociaciones deporte-discapacidad,
 * eventos deportivos y panel del organizador. Ver features/MODULES.md.
 */
@NgModule({
  declarations: [
    SportsPageComponent,
    DisabilitiesPageComponent,
    AssociationsPageComponent,
    EventsPageComponent,
    OrganizerDashboardComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    SportsPageComponent,
    DisabilitiesPageComponent,
    AssociationsPageComponent,
    EventsPageComponent,
    OrganizerDashboardComponent
  ]
})
export class SportsDisabilitiesModule {}
