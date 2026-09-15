import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SubscriptionService } from '../../services/subscription.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { EventItem } from '@features/sports-disabilities/models/sports';
import { ConfiguracionEventoPagoResponse, Plan, SuscripcionResponse } from '../../models/subscription-models';

/**
 * M09 - Configurar un evento como pago (RF55, RF63, organizador). Fija si un evento
 * requiere tarifa de inscripción y por cuánto; la comisión de plataforma la define
 * el plan de suscripción vigente del organizador (solo lectura aquí).
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-event-payment-setup',
  templateUrl: './event-payment-setup.component.html',
  styleUrl: './event-payment-setup.component.scss'
})
export class EventPaymentSetupComponent implements OnInit {
  eventoId = '';
  evento: EventItem | null = null;
  plan: Plan | null = null;
  configExistente: ConfiguracionEventoPagoResponse | null = null;

  esPago = false;
  valorInscripcion = 0;
  estimadoInscripciones = 100;

  cargando = true;
  guardando = false;
  error: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly subscriptions: SubscriptionService,
    private readonly sports: SportsService,
  ) {}

  ngOnInit(): void {
    this.eventoId = this.route.snapshot.paramMap.get('eventoId') ?? '';
    if (!this.eventoId) {
      this.error = 'No se indicó el evento a configurar.';
      this.cargando = false;
      return;
    }

    this.sports.getEvent(this.eventoId).subscribe({
      next: (evento) => (this.evento = evento),
      error: () => (this.error = 'No se pudo cargar la información del evento.'),
    });

    this.subscriptions.getSuscripcionActual().subscribe({
      next: (suscripcion: SuscripcionResponse) => {
        this.subscriptions.getPlanes().subscribe({
          next: (planes) => (this.plan = planes.find((p) => p.id === suscripcion.planId) ?? null),
        });
      },
    });

    this.subscriptions.getConfiguracionEventoPago(this.eventoId).subscribe({
      next: (config) => {
        this.configExistente = config;
        this.esPago = config.esPago;
        this.valorInscripcion = config.valorInscripcion ?? 0;
        this.cargando = false;
      },
      error: () => {
        // 404 = todavía no se configuró este evento; se parte de "gratuito" por defecto.
        this.cargando = false;
      },
    });
  }

  get comisionPct(): number {
    return this.plan?.porcentajeComision ?? 0;
  }

  get comisionPorAtleta(): number {
    return Math.round((this.valorInscripcion * this.comisionPct) / 100);
  }

  get netoPorAtleta(): number {
    return this.valorInscripcion - this.comisionPorAtleta;
  }

  get proyeccionBruto(): number {
    return this.valorInscripcion * this.estimadoInscripciones;
  }

  get proyeccionComision(): number {
    return this.comisionPorAtleta * this.estimadoInscripciones;
  }

  get proyeccionNeto(): number {
    return this.proyeccionBruto - this.proyeccionComision;
  }

  guardar(): void {
    this.error = null;
    this.guardando = true;

    const body = {
      eventoId: this.eventoId,
      esPago: this.esPago,
      valorInscripcion: this.esPago ? Number(this.valorInscripcion) || 0 : 0,
    };

    const peticion$ = this.configExistente
      ? this.subscriptions.actualizarConfiguracionEventoPago(this.eventoId, body)
      : this.subscriptions.configurarEventoPago(body);

    peticion$.subscribe({
      next: (config) => {
        this.configExistente = config;
        this.guardando = false;
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo guardar la configuración de pago.';
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/organizer/events']);
  }
}
