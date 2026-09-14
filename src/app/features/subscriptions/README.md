# M09 · Suscripciones

Las páginas de organizador (`/organizer/plans`, `/organizer/subscription`, `/organizer/payments`)
hablan con `ink-ms-subscriptions` a través del gateway (`/api/planes`, `/api/suscripciones`, `/api/pagos`).

Los cobros van en **COP** por Mercado Pago Checkout Pro (o mock en desarrollo). Tras el checkout
el usuario vuelve a `/pagos/exito|pendiente|error`.
