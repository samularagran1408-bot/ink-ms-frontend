import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { SubscriptionService } from '../../services/subscription.service';
import { HistorialSuscripcionResponse, SuscripcionResponse } from '../../models/subscription-models';
import { UsersService } from '@features/users/services/users.service';
import { UserProfile } from '@core/models/user-profile';

type EstadoSuscripcion = 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';

interface AccionEstado {
  estado: EstadoSuscripcion;
  titulo: string;
  descripcion: string;
  peligrosa: boolean;
}

/**
 * M09 - Gestión admin de suscripciones de organizadores ajenos (RF58). No existe un
 * listado global de suscripciones en el backend, así que el flujo es buscar por correo
 * (reusa `UsersService.getUserByEmail` de ink-ms-users) y operar sobre lo encontrado.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-admin-subscriptions',
  templateUrl: './admin-subscriptions.component.html',
  styleUrl: './admin-subscriptions.component.scss',
})
export class AdminSubscriptionsComponent {
  readonly acciones: AccionEstado[] = [
    { estado: 'ACTIVA', titulo: 'Activar / reactivar', descripcion: 'Restaura el acceso pleno a la creación de eventos.', peligrosa: false },
    { estado: 'SUSPENDIDA', titulo: 'Suspender temporalmente', descripcion: 'Bloquea la publicación de nuevos eventos.', peligrosa: true },
    { estado: 'VENCIDA', titulo: 'Marcar como vencida', descripcion: 'Invita al organizador a renovar su membresía.', peligrosa: false },
    { estado: 'CANCELADA', titulo: 'Cancelar suscripción', descripcion: 'Termina el contrato de forma definitiva.', peligrosa: true },
  ];

  emailBusqueda = '';
  buscando = false;
  errorBusqueda: string | null = null;

  organizador: UserProfile | null = null;
  suscripcion: SuscripcionResponse | null = null;
  historial: HistorialSuscripcionResponse[] = [];
  cargandoDetalle = false;

  accionSeleccionada: AccionEstado | null = null;
  aplicandoCambio = false;
  errorCambio: string | null = null;

  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  buscar(): void {
    const email = this.emailBusqueda.trim();
    if (!email || this.buscando) {
      return;
    }
    this.buscando = true;
    this.errorBusqueda = null;
    this.organizador = null;
    this.suscripcion = null;
    this.historial = [];
    this.accionSeleccionada = null;

    this.users.getUserByEmail(email).subscribe({
      next: (user) => {
        this.organizador = user;
        this.cargarDetalle(user.id);
      },
      error: () => {
        this.buscando = false;
        this.errorBusqueda = 'No se encontró ningún usuario con ese correo.';
      },
    });
  }

  private cargarDetalle(organizadorId: string): void {
    this.cargandoDetalle = true;
    forkJoin({
      suscripciones: this.subscriptions.getSuscripcionesPorOrganizador(organizadorId).pipe(catchError(() => of([]))),
      historial: this.subscriptions.getHistorialPorOrganizador(organizadorId).pipe(catchError(() => of([]))),
    }).subscribe(({ suscripciones, historial }) => {
      this.suscripcion = suscripciones[0] ?? null;
      this.historial = historial;
      this.buscando = false;
      this.cargandoDetalle = false;
    });
  }

  accionDisponible(accion: AccionEstado): boolean {
    return this.suscripcion?.estado !== accion.estado;
  }

  seleccionarAccion(accion: AccionEstado): void {
    if (!this.suscripcion || !this.accionDisponible(accion)) {
      return;
    }
    this.accionSeleccionada = accion;
    this.errorCambio = null;
  }

  cancelarAccion(): void {
    this.accionSeleccionada = null;
    this.errorCambio = null;
  }

  confirmarCambio(): void {
    if (!this.suscripcion || !this.accionSeleccionada || !this.organizador || this.aplicandoCambio) {
      return;
    }
    const organizadorId = this.organizador.id;
    this.aplicandoCambio = true;
    this.errorCambio = null;

    this.subscriptions.cambiarEstadoSuscripcion(this.suscripcion.id, { estado: this.accionSeleccionada.estado }).subscribe({
      next: (actualizada) => {
        this.suscripcion = actualizada;
        this.aplicandoCambio = false;
        this.accionSeleccionada = null;
        this.subscriptions.getHistorialPorOrganizador(organizadorId).subscribe((historial) => (this.historial = historial));
      },
      error: (err) => {
        this.aplicandoCambio = false;
        this.errorCambio = err?.error?.message ?? 'No se pudo aplicar el cambio de estado.';
      },
    });
  }
}
