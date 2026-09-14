// Vacío = mismo origen. En Docker/nginx /api va al gateway, en `ng serve`
// el proxy.conf.json reenvía /api a localhost:8080.
export const API_BASE_URL = '';

/**
 * Public key de Mercado Pago (RF70) para tokenizar tarjetas con el SDK JS en el
 * navegador. No es secreta (a diferencia del Access Token, que solo vive en el
 * backend de ink-ms-subscriptions).
 */
export const MERCADOPAGO_PUBLIC_KEY = 'TEST-faf3c04b-420e-4465-a899-de4d2a473c6d';
