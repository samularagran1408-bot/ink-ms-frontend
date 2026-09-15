import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PagoCheckout } from '../models/subscriptions';

@Injectable({
  providedIn: 'root'
})
export class CheckoutRedirectService {
  constructor(private router: Router) {}

  follow(checkout: PagoCheckout, extra: Record<string, string | number | null | undefined> = {}): void {
    if (checkout.checkoutUrl && checkout.estado !== 'APROBADO') {
      window.location.href = checkout.checkoutUrl;
      return;
    }
    void this.router.navigate(['/pagos/exito'], {
      queryParams: {
        pagoId: checkout.pagoId ?? undefined,
        ref: checkout.referenciaTransaccion ?? undefined,
        ...extra
      }
    });
  }
}
