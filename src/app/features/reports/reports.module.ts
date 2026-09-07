import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * M06 - Reportes y Analitica.
 *
 * Hoy este modulo solo agrupa el contrato de datos: `ReportsService`
 * (`services/reports.service.ts`, `providedIn: 'root'`) y `models/reports.ts`,
 * consumidos por los paneles de M05 (admin) y por varias paginas.
 *
 * Pendiente (ver README.md): dashboard de estadisticas dedicado, exportacion
 * CSV/PDF, reportes filtrados por fecha/categoria y reportes programados.
 */
@NgModule({
  imports: [CommonModule]
})
export class ReportsModule {}
