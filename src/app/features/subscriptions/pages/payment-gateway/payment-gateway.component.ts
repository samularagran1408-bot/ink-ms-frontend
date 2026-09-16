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
 * app en lugar de redirigir a la interfaz de Mercado Pago. El número de tarjeta y el
 * CVV se capturan en iframes que monta el SDK JS de MP (nunca tocan este componente
 * ni nuestro backend); solo se maneja el `token` que el SDK genera en el navegador.
 *
 * Llega desde OrganizerPlansComponent, que ya creó el pago PENDIENTE
 * (`POST /api/suscripciones` o `/renovar`) y navega aquí con la `referenciaTransaccion`
 * en la URL y `{ plan, monto }` en el router state. Si no hay state (recarga directa
 * de la página), se recupera el monto consultando el estado del pago.
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
  monto = 0;

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

  ngOnInit(): void {
    this.referencia = this.route.snapshot.paramMap.get('referencia') ?? '';

    const state = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as
      | { plan?: Plan; monto?: number }
      | undefined;

    if (state?.plan && state?.monto != null) {
      this.plan = state.plan;
      this.monto = state.monto;
      this.cargando = false;
      return;
    }

    // Sin state (recarga directa de /organizer/plans/pago/:referencia): se recupera el
    // monto consultando el pago. Si ya no está PENDIENTE, no tiene sentido mostrar
    // el formulario de nuevo.
    this.subscriptions.consultarEstadoPago(this.referencia).subscribe({
      next: (r) => {
        if (r.estado !== 'PENDIENTE') {
          this.router.navigate(['/organizer/subscription']);
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
          // El SDK muestra/oculta su propio loader interno; nada que hacer aquí.
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

    this.procesando = true;
    this.error = null;

    this.subscriptions
      .pagarConTarjeta(this.referencia, {
        cardToken: datos.token,
        installments: Number(datos.installments),
        paymentMethodId: datos.paymentMethodId,
        issuerId: datos.issuerId,
        docType: datos.identificationType,
        docNumber: datos.identificationNumber,
      })
      .subscribe({
        next: (resp) => {
          this.procesando = false;
          if (resp.estado === 'APROBADO') {
            this.resultado = 'exito';
            this.mensajeResultado = '¡Pago aprobado! Tu suscripción ya está activa.';
            setTimeout(
              () => this.router.navigate(['/organizer/payments/receipt'], { queryParams: { ref: this.referencia } }),
              2000,
            );
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
          this.error = err?.error?.message ?? 'No se pudo procesar el pago. Intenta de nuevo.';
        },
      });
  }

  volver(): void {
    this.router.navigate(['/organizer/plans']);
  }
}
