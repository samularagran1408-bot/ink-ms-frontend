# M07 · Filtros y Búsquedas Administrativas

Ver `../MODULES.md` para el mapa completo.

## Estado actual

Scaffold (`search.module.ts` vacío). El filtrado y ordenamiento hoy está **inline** en
las tablas de otras features:

- `@features/users/pages/admin-users` — búsqueda y filtros de usuarios.
- `@features/sports-disabilities/pages/events-page` — filtros de eventos.

## Pendiente (RF37–RF40)

- **RF37** Filtrar usuarios inscritos por evento específico.
- **RF38** Búsqueda global (usuarios, eventos, reportes) desde un solo campo.
- **RF39** Filtrado de eventos por ciudad / fecha / categoría.
- **RF40** Ordenamiento dinámico de tablas (nombre, fecha, deporte, discapacidad…).

Objetivo del módulo: extraer esos filtros a componentes/servicios reutilizables
(p. ej. `components/filter-bar`, `services/global-search.service`) que consuman
`admin-users`, `events-page`, etc.
