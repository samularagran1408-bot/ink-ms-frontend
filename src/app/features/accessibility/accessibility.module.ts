import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { AccessibilityPageComponent } from './pages/accessibility-page/accessibility-page.component';
import { NotificationsPageComponent } from './pages/notifications-page/notifications-page.component';

/**
 * M04 - Interfaz y Accesibilidad.
 * Ajustes de accesibilidad (contraste, fuente, lector), idioma, preferencias
 * y notificaciones adaptadas. Servicios app-wide de accesibilidad/idioma/TTS.
 * Ver features/MODULES.md.
 */
@NgModule({
  declarations: [
    AccessibilityPageComponent,
    NotificationsPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    AccessibilityPageComponent,
    NotificationsPageComponent
  ]
})
export class AccessibilityModule {}
