# M06 · Reportes y Analítica

Ver `../MODULES.md` para el mapa completo.

## Estado actual

| Archivo | Qué es |
|---|---|
| `services/reports.service.ts` | Cliente HTTP de paneles/métricas (`providedIn: 'root'`). Lo consumen los paneles de M05 y varias páginas de M02/M03/M08. |
| `models/reports.ts` | Contratos de respuesta de dashboards y paneles por rol. |
| `reports.module.ts` | NgModule estructural (sin declarations todavía). |

## Pendiente (RF32–RF36)

- **RF32** Generación de reportes de participación/asistencia por tipo de discapacidad.
- **RF33** Exportación CSV / PDF de listados.
- **RF34** Dashboard de estadísticas con gráficas (barras, tortas, líneas).
- **RF35** Reportes filtrados por rango de fechas, deporte o discapacidad.
- **RF36** Reportes automáticos programados (semanal/mensual) al correo del admin.

Cuando exista UI dedicada, crear `pages/` aquí y declararla en `ReportsModule`
(que pasaría a exportar sus componentes, como el resto de feature modules).
