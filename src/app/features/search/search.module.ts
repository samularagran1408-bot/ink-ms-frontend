import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * M07 - Filtros y Busquedas Administrativas.
 *
 * Scaffold. Hoy el filtrado/ordenamiento vive inline en las tablas de
 * `@features/users` (admin-users) y `@features/sports-disabilities` (events-page).
 * Este modulo es el hogar previsto para extraer esos filtros a componentes/
 * servicios reutilizables. Ver README.md (RF37-RF40).
 */
@NgModule({
  imports: [CommonModule]
})
export class SearchModule {}
