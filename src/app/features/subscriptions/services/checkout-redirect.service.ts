import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class CheckoutRedirectService {
  constructor(private router: Router) {}

  follow(
    checkout: {
      pagoId?: number | null;
      estado?: string | null;
      referenciaTransaccion?: string | null;
      checkoutUrl?: string | null;
    },
    extra: Record<string, string | number | null | undefined> = {},
  ): void {
    // RF70: el cobro siempre ocurre dentro de InkluSport (formulario embebido).
    // Nunca redirigir a la interfaz externa de Mercado Pago Checkout Pro.
    const ref = checkout.referenciaTransaccion;
    if (ref && String(ref).startsWith('PE-') && checkout.estado !== 'APROBADO') {
      void this.router.navigate(['/home/eventos/checkout', ref], {
        state: {
          monto: undefined,
          eventoNombre: extra['evento'] ?? null,
        },
      });
      return;
    }
    if (ref && String(ref).startsWith('PS-') && checkout.estado !== 'APROBADO') {
      void this.router.navigate(['/organizer/plans/pago', ref], { state: extra });
      return;
    }
    void this.router.navigate(['/pagos/exito'], {
      queryParams: {
        pagoId: checkout.pagoId ?? undefined,
        ref: ref ?? undefined,
        ...extra
      }
    });
  }
}
