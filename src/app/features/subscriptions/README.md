# M09 · Suscripciones

Ver `../MODULES.md` para el mapa completo.

## Estado actual

Scaffold (`subscriptions.module.ts` vacío). Sin implementación en el frontend todavía.

## Pendiente (RF54–RF68)

- **RF54** Visualización de planes (beneficios, límites, duración).
- **RF55 / RF63** Inscripción a eventos pagos · configuración de evento gratuito/pago.
- **RF56 / RF64** Suscripción para organizadores · plan gratuito inicial automático.
- **RF57 / RF58** Estado de suscripción (activa/vencida/cancelada) · control de límites de plan.
- **RF59 / RF60** Renovación · notificaciones de vencimiento.
- **RF61 / RF66** Historial de suscripciones · historial de pagos del usuario.
- **RF62** Reportes financieros (ingresos por evento, inscritos, comisiones).
- **RF65** Administración de planes (precio, límites, comisión, beneficios).
- **RF67 / RF68** Comprobante de pago e inscripción por correo · integración con pasarela de pago.

Estructura prevista: `pages/` (planes, checkout, historial), `services/` (subscriptions,
payments), `models/` (plan, subscription, transaction), declarados en `SubscriptionsModule`.
