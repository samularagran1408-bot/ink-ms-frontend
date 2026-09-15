const MP_SDK_SRC = 'https://sdk.mercadopago.com/js/v2';

let loading: Promise<void> | null = null;

/**
 * Carga el SDK de Mercado Pago solo en el checkout (no en cada página).
 */
export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if ((window as Window & { MercadoPago?: unknown }).MercadoPago) {
    return Promise.resolve();
  }
  if (loading) {
    return loading;
  }
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${MP_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Mercado Pago SDK')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = MP_SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Mercado Pago SDK'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
