import { Component, OnInit } from '@angular/core';
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
 * M09 - Gestión admin de suscripciones (RF58). El listado sale de Mongo
 * (`GET /api/suscripciones/admin`); el detalle y el historial se cargan por organizador.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-admin-subscriptions',
  templateUrl: './admin-subscriptions.component.html',
  styleUrl: './admin-subscriptions.component.scss',
})
export class AdminSubscriptionsComponent implements OnInit {
  readonly acciones: AccionEstado[] = [
    { estado: 'ACTIVA', titulo: 'Activar / reactivar', descripcion: 'Restaura el acceso pleno a la creación de eventos.', peligrosa: false },
    { estado: 'SUSPENDIDA', titulo: 'Suspender temporalmente', descripcion: 'Bloquea la publicación de nuevos eventos.', peligrosa: true },
    { estado: 'VENCIDA', titulo: 'Marcar como vencida', descripcion: 'Invita al organizador a renovar su membresía.', peligrosa: false },
    { estado: 'CANCELADA', titulo: 'Cancelar suscripción', descripcion: 'Termina el contrato de forma definitiva.', peligrosa: true },
  ];

  listado: SuscripcionResponse[] = [];
  cargandoListado = true;
  errorListado: string | null = null;

  emailBusqueda = '';
  buscando = false;
  errorBusqueda: string | null = null;

  organizador: UserProfile | null = null;
  suscripcion: SuscripcionResponse | null = null;
  historial: HistorialSuscripcionResponse[] = [];
  cargandoDetalle = false;

  accionSeleccionada: AccionEstado | null = null;
  motivo = '';
  aplicandoCambio = false;
  errorCambio: string | null = null;

  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  ngOnInit(): void {
    this.cargarListado();
  }

  cargarListado(): void {
    this.cargandoListado = true;
    this.errorListado = null;
    this.subscriptions.getSuscripcionesAdmin().subscribe({
      next: (listado) => {
        this.listado = listado;
        this.cargandoListado = false;
      },
      error: () => {
        this.errorListado = 'No se pudieron cargar las suscripciones.';
        this.cargandoListado = false;
      },
    });
  }

  seleccionarDelListado(item: SuscripcionResponse): void {
    this.emailBusqueda = item.organizadorEmail ?? '';
    this.errorBusqueda = null;
    this.accionSeleccionada = null;
    this.suscripcion = item;
    this.cargandoDetalle = true;
    this.organizador = null;
    this.historial = [];

    forkJoin({
      usuario: this.users.getUserById(item.organizadorId).pipe(catchError(() => of(null))),
      historial: this.subscriptions.getHistorialPorOrganizador(item.organizadorId).pipe(catchError(() => of([]))),
    }).subscribe(({ usuario, historial }) => {
      this.organizador = usuario ?? {
        id: item.organizadorId,
        email: item.organizadorEmail ?? item.organizadorId,
        fullName: item.organizadorEmail ?? 'Organizador',
      };
      this.historial = historial;
      this.cargandoDetalle = false;
    });
  }

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
    this.motivo = '';
    this.errorCambio = null;
  }

  cancelarAccion(): void {
    this.accionSeleccionada = null;
    this.motivo = '';
    this.errorCambio = null;
  }

  confirmarCambio(): void {
    if (!this.suscripcion || !this.accionSeleccionada || !this.organizador || this.aplicandoCambio) {
      return;
    }
    const organizadorId = this.organizador.id;
    this.aplicandoCambio = true;
    this.errorCambio = null;

    this.subscriptions.cambiarEstadoSuscripcion(this.suscripcion.id, {
      estado: this.accionSeleccionada.estado,
      motivo: this.motivo.trim() || null,
    }).subscribe({
      next: (actualizada) => {
        this.suscripcion = actualizada;
        this.aplicandoCambio = false;
        this.accionSeleccionada = null;
        this.motivo = '';
        this.subscriptions.getHistorialPorOrganizador(organizadorId).subscribe((historial) => (this.historial = historial));
        this.cargarListado();
      },
      error: (err) => {
        this.aplicandoCambio = false;
        this.errorCambio = err?.error?.message ?? 'No se pudo aplicar el cambio de estado.';
      },
    });
  }
}
