# M09 · Suscripciones

Ver `../MODULES.md` para el mapa completo.

## Estado actual

`SubscriptionsModule` es vestigial (`imports: [CommonModule]`): todas las páginas son
**standalone** y se cargan por ruta (`loadComponent`) desde `panel-routing.module.ts`.
El backend (`ink-ms-subscriptions`) está completo para todo M09; `SubscriptionService`
(`services/subscription.service.ts`) ya tiene un método por cada endpoint. Lo que falta
es exclusivamente **frontend**.

### Construido y conectado a datos reales

| RF | Página | Ruta |
|---|---|---|
| RF54, RF56, RF70 | `organizer-plans` | `/organizer/plans`, `/admin/subscriptions` |
| RF57 | `subscription` | `/organizer/subscription` |
| RF70 | `payment-gateway` (checkout propio, tarjeta vía SDK Mercado Pago) | `/organizer/plans/pago/:referencia` |
| RF61, RF66 | `payment-history` | `/organizer/payments` |
| RF67, RF68 | `proof-of-payment` | `/organizer/payments/receipt` |

### Scaffold — ruta ya cableada, vista pendiente de diseño (ver prompt de diseño)

| RF | Página | Ruta | Rol |
|---|---|---|---|
| RF65 | `admin-plans` | `/admin/plans` | ADMIN |
| RF61 | `subscription-history` (historial de *movimientos*, distinto de `payment-history`) | `/organizer/subscription/historial` | ORGANIZADOR |
| RF58 | `admin-subscriptions` | `/admin/organizer-subscriptions` | ADMIN |
| RF55, RF63 | `event-payment-setup` | `/organizer/events/:eventoId/pago-config` | ORGANIZADOR |
| RF57 | `event-registration-payment` (Checkout Pro, redirect — no usa el checkout propio de tarjeta) | `/home/eventos/:eventoId/pago` | USUARIO |
| RF57, RF68 | `event-payment-history` | `/home/pagos-eventos` | USUARIO |
| RF62 | `financial-reports` (mismo componente, `data: { mode: 'own' \| 'global' }`) | `/organizer/reports`, `/admin/reports` | ORGANIZADOR / ADMIN |

Estructura real: `pages/<nombre>/` (una carpeta por página), `services/subscription.service.ts`
(único servicio para todo M09), `models/subscription-models.ts` (interfaces alineadas 1:1
con los DTO de `ink-ms-subscriptions`).
