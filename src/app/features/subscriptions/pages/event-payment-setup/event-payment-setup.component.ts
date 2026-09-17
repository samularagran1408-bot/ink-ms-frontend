import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SubscriptionService } from '../../services/subscription.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { EventItem } from '@features/sports-disabilities/models/sports';
import { ConfiguracionEventoPagoResponse, Plan, SuscripcionResponse } from '../../models/subscription-models';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';

/**
 * M09 - Configurar un evento como pago (RF55, RF63, organizador/admin).
 * Fija si el evento requiere tarifa y por cuánto. La comisión de plataforma la
 * define el plan de suscripción vigente del organizador (solo lectura aquí).
 * Con esPago=true, todo atleta paga al inscribirse — también la primera vez (RF57).
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
  suscripcion: SuscripcionResponse | null = null;
  configExistente: ConfiguracionEventoPagoResponse | null = null;

  esPago = false;
  valorInscripcion = 0;
  estimadoInscripciones = 100;

  cargando = true;
  guardando = false;
  error: string | null = null;
  exito = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly subscriptions: SubscriptionService,
    private readonly sports: SportsService,
    private readonly confirm: ConfirmDialogService,
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
        this.suscripcion = suscripcion;
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
    return this.suscripcion?.porcentajeComisionAplicado ?? this.plan?.porcentajeComision ?? 0;
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

  async guardar(): Promise<void> {
    this.error = null;
    this.exito = false;

    if (this.esPago && (!this.valorInscripcion || this.valorInscripcion <= 0)) {
      this.error = 'Indica un valor de inscripción mayor a 0.';
      await this.confirm.warning({
        title: 'Valor requerido',
        message: this.error,
        variant: 'ack',
      });
      return;
    }

    const resumen = this.esPago
      ? `El evento quedará de pago a ${Number(this.valorInscripcion).toLocaleString('es-CO')} COP. Los atletas deberán pagar desde la primera inscripción.`
      : 'El evento quedará gratuito: los atletas se inscribirán sin pasar por la pasarela.';

    const ok = await this.confirm.ask({
      title: 'Guardar configuración de pago',
      message: resumen,
      confirmLabel: 'Guardar',
      cancelLabel: 'Cancelar',
    });
    if (!ok) {
      return;
    }

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
        this.esPago = config.esPago;
        this.valorInscripcion = config.valorInscripcion ?? 0;
        this.guardando = false;
        this.exito = true;
        void this.confirm.ack({
          title: 'Configuración guardada',
          message: this.esPago
            ? 'Los atletas verán el panel de pago al inscribirse.'
            : 'El evento quedó configurado como gratuito.',
        });
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.message ?? err?.error?.detail ?? 'No se pudo guardar la configuración de pago.';
        void this.confirm.error({
          title: 'No se pudo guardar',
          message: this.error!,
        });
      },
    });
  }

  async cancelar(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Salir sin guardar',
      message: 'Si hay cambios sin guardar se perderán. ¿Volver a gestionar eventos?',
      confirmLabel: 'Salir',
      cancelLabel: 'Seguir aquí',
      tone: 'warning',
    });
    if (ok) {
      void this.router.navigate(['/organizer/events']);
    }
  }
}
