import { AfterViewInit, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { MERCADOPAGO_PUBLIC_KEY } from '@core/config/api.config';
import { SubscriptionService } from '../../services/subscription.service';
import { Plan } from '../../models/subscription-models';
import { loadMercadoPagoSdk } from '../../utils/mercadopago-sdk';

declare const MercadoPago: any;

interface IdentificacionTipo {
  id: string;
  name: string;
}

/**
 * M09 · Checkout propio de Mercado Pago (RF70): formulario de tarjeta embebido en la
 * app. Sirve para planes (PS-) e inscripciones a eventos (PE-).
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-payment-gateway',
  templateUrl: './payment-gateway.component.html',
  styleUrl: './payment-gateway.component.scss',
})
export class PaymentGatewayComponent implements OnInit, AfterViewInit {
  referencia = '';
  plan: Plan | null = null;
  eventoNombre: string | null = null;
  eventoId: string | null = null;
  monto = 0;
  modo: 'suscripcion' | 'evento' = 'suscripcion';

  tiposIdentificacion: IdentificacionTipo[] = [];

  cargando = true;
  procesando = false;
  error: string | null = null;
  resultado: 'exito' | 'rechazado' | 'pendiente' | null = null;
  mensajeResultado = '';

  private cardForm: any;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly subscriptions: SubscriptionService,
    private readonly zone: NgZone,
  ) {}

  get tituloConcepto(): string {
    if (this.modo === 'evento') {
      return this.eventoNombre || 'Inscripción a evento';
    }
    return this.plan?.nombre || 'Suscripción';
  }

  ngOnInit(): void {
    this.referencia = this.route.snapshot.paramMap.get('referencia') ?? '';
    const dataMode = this.route.snapshot.data['mode'] as string | undefined;
    if (dataMode === 'evento' || this.referencia.startsWith('PE-')) {
      this.modo = 'evento';
    }

    const state = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as
      | { plan?: Plan; monto?: number; eventoNombre?: string; eventoId?: string }
      | undefined;

    if (state?.monto != null && (state.plan || state.eventoNombre || this.modo === 'evento')) {
      this.plan = state.plan ?? null;
      this.eventoNombre = state.eventoNombre ?? null;
      this.eventoId = state.eventoId ?? null;
      this.monto = state.monto;
      this.cargando = false;
      return;
    }

    this.subscriptions.consultarEstadoPago(this.referencia).subscribe({
      next: (r) => {
        if (r.estado !== 'PENDIENTE') {
          void this.router.navigate(this.modo === 'evento' ? ['/home/events'] : ['/organizer/subscription']);
          return;
        }
        this.monto = r.monto;
        this.cargando = false;
        setTimeout(() => this.initCardForm());
      },
      error: () => {
        this.error = 'No se encontró este pago o ya expiró.';
        this.cargando = false;
      },
    });
  }

  ngAfterViewInit(): void {
    if (!this.cargando) {
      setTimeout(() => this.initCardForm());
    }
  }

  private initCardForm(): void {
    if (!this.monto || this.monto <= 0) {
      this.zone.run(() => {
        this.error =
          'Este cobro no tiene un monto válido (debe ser mayor a 0). ' +
          (this.modo === 'evento'
            ? 'Pide al organizador que configure un valor de inscripción mayor a 0 y vuelve a intentar.'
            : 'Elige de nuevo el plan e inicia el pago otra vez.');
      });
      return;
    }

    void loadMercadoPagoSdk()
      .then(() => this.mountCardForm())
      .catch(() => {
        this.zone.run(() => (this.error = 'No se pudo cargar Mercado Pago. Revisa tu conexión e intenta de nuevo.'));
      });
  }

  private mountCardForm(): void {
    if (typeof MercadoPago === 'undefined') {
      this.zone.run(() => (this.error = 'No se pudo cargar Mercado Pago. Revisa tu conexión e intenta de nuevo.'));
      return;
    }

    const mp = new MercadoPago(MERCADOPAGO_PUBLIC_KEY, { locale: 'es-CO' });

    mp.getIdentificationTypes()
      .then((tipos: IdentificacionTipo[]) => this.zone.run(() => (this.tiposIdentificacion = tipos)))
      .catch(() => this.zone.run(() => (this.tiposIdentificacion = [{ id: 'CC', name: 'Cédula de ciudadanía' }])));

    this.cardForm = mp.cardForm({
      amount: String(this.monto),
      iframe: true,
      form: {
        id: 'form-checkout',
        cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta' },
        expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
        securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
        cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular de la tarjeta' },
        issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
        installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
        identificationType: { id: 'form-checkout__identificationType', placeholder: 'Tipo de documento' },
        identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'Número de documento' },
        cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Correo electrónico' },
      },
      callbacks: {
        onFormMounted: (mountError: unknown) => {
          if (mountError) {
            this.zone.run(() => (this.error = 'No se pudo inicializar el formulario de pago. Recarga la página.'));
          }
        },
        onSubmit: (event: Event) => {
          event.preventDefault();
          const datos = this.cardForm.getCardFormData();
          this.zone.run(() => this.confirmarPago(datos));
        },
        onFetching: () => {
          return () => undefined;
        },
      },
    });
  }

  private confirmarPago(datos: any): void {
    if (!datos?.token) {
      this.error = 'No se pudo validar la tarjeta. Revisa los datos e intenta de nuevo.';
      return;
    }

    // Si MP no cargó cuotas (amount 0, BIN desconocido, etc.), el select queda vacío
    // y el backend responde 400 "debe ser mayor que 0". Forzamos al menos 1 cuota.
    const installments = Math.max(1, parseInt(String(datos.installments ?? '1'), 10) || 1);
    const paymentMethodId = String(datos.paymentMethodId || '').trim();
    if (!paymentMethodId) {
      this.error =
        'No se reconoció el medio de pago. Completa el número de tarjeta y espera a que carguen banco y cuotas.';
      return;
    }

    this.procesando = true;
    this.error = null;

    this.subscriptions
      .pagarConTarjeta(this.referencia, {
        cardToken: datos.token,
        installments,
        paymentMethodId,
        issuerId: datos.issuerId != null && datos.issuerId !== '' ? String(datos.issuerId) : undefined,
        docType: String(datos.identificationType || '').trim(),
        docNumber: String(datos.identificationNumber || '').trim(),
      })
      .subscribe({
        next: (resp) => {
          this.procesando = false;
          if (resp.estado === 'APROBADO') {
            this.resultado = 'exito';
            this.mensajeResultado = this.modo === 'evento'
              ? '¡Pago aprobado! Tu inscripción al evento quedó confirmada.'
              : '¡Pago aprobado! Tu suscripción ya está activa.';
            setTimeout(() => {
              if (this.modo === 'evento') {
                void this.router.navigate(['/home/pagos-eventos'], {
                  queryParams: { refreshed: Date.now() },
                });
              } else {
                void this.router.navigate(['/organizer/payments/receipt'], {
                  queryParams: { ref: this.referencia },
                });
              }
            }, 2000);
          } else if (resp.estado === 'RECHAZADO') {
            this.resultado = 'rechazado';
            this.mensajeResultado = 'El pago fue rechazado. Verifica los datos de la tarjeta o intenta con otra.';
          } else {
            this.resultado = 'pendiente';
            this.mensajeResultado = 'Tu pago está en proceso de confirmación. Te avisaremos por correo.';
          }
        },
        error: (err) => {
          this.procesando = false;
          const status = err?.status;
          if (status === 401) {
            this.error = 'Tu sesión expiró. Vuelve a iniciar sesión e intenta el pago otra vez.';
            return;
          }
          this.error = err?.error?.message
            ?? err?.error?.detail
            ?? 'No se pudo procesar el pago. Intenta de nuevo.';
        },
      });
  }

  volver(): void {
    if (this.modo === 'evento') {
      void this.router.navigate(
        this.eventoId ? ['/home/eventos', this.eventoId, 'pago'] : ['/home/events'],
      );
      return;
    }
    void this.router.navigate(['/organizer/plans']);
  }
}
