# Mapa de módulos — `src/app/features/`

El código está agrupado por los **9 módulos funcionales del SRS (M01–M09)**. Cada carpeta
de `features/` es un dominio; el nombre es semántico (coherente con `core/` y `shared/`) y
esta tabla es la traza a los RF.

| Carpeta | Módulo SRS | RF cubiertos | NgModule |
|---|---|---|---|
| `auth/` | **M01 · Autenticación** | RF01–RF06 | `AuthModule` (lazy propio, `/`) |
| `users/` | **M02 · Usuarios** | RF07–RF13, RF10 | `UsersModule` |
| `sports-disabilities/` | **M03 · Deportes y Discapacidades** | RF14–RF20 | `SportsDisabilitiesModule` |
| `accessibility/` | **M04 · Interfaz y Accesibilidad** | RF21–RF25 | `AccessibilityModule` |
| `admin/` | **M05 · Gestión Administrativa** | RF26–RF31 | `AdminModule` |
| `reports/` | **M06 · Reportes y Analítica** | RF32–RF36 | `ReportsModule` (scaffold) |
| `search/` | **M07 · Filtros y Búsquedas** | RF37–RF40 | `SearchModule` (scaffold) |
| `assistant/` | **M08 · Asistente Virtual Inteligente** | RF41–RF53 | `AssistantModule` |
| `subscriptions/` | **M09 · Suscripciones** | RF54–RF68 | `SubscriptionsModule` (scaffold) |
| `panel/` | *(infra)* | — | `PanelModule` — raíz de composición del área autenticada |

## Cómo encaja el enrutado

El enrutado sigue siendo **por rol** (`/home`, `/admin`, `/trainer`, `/organizer`,
`/asistencia`) y vive en `panel/panel-routing.module.ts`. `PanelModule` importa los
feature modules M02–M09; cada uno **declara y exporta** sus páginas, y el router las
referencia. `AuthModule` (M01) se mantiene como chunk lazy independiente.

Resultado: un solo chunk lazy `panel` (igual que antes del refactor), mismas rutas,
mismo runtime. La agrupación es de código fuente, no de bundles.

## Contenido por módulo

### M02 · `users/`
- **pages**: `user-interface` (home del usuario), `profile-page`, `admin-users`,
  `admin-user-detail`, `athletes-page`, `attendance-checkin-page`, `aptitude-quiz-page`
- **services**: `users.service`, `quiz.service`
- Ownership conceptual del contrato de usuario y roles, cuyo **tipo base** vive en
  `@core/models/{user-profile,app-role}` porque lo consume `SessionService` y los guards.

### M03 · `sports-disabilities/`
- **pages**: `sports-page`, `disabilities-page`, `associations-page`, `events-page`,
  `organizer-dashboard`
- **services**: `sports.service`
- **models**: `sports.ts`
- **utils**: `event-image.util`, `maps.util`
- `DisabilityType` (enum del formulario de registro) se queda en `@features/auth/models/`
  porque su único consumidor es el alta de M01.

### M04 · `accessibility/`
- **pages**: `accessibility-page`, `notifications-page`
- **services**: `accessibility`, `language`, `tts`, `preferences-api`,
  `notification-announce`, `unread-notifications` (varios son app-wide: los usa
  `AppComponent` y `SessionService` al iniciar sesión)
- **models**: `accessibility-api.ts`

### M05 · `admin/`
- **pages**: `admin-dashboard`, `admin-roles`, `admin-audit`
- Reutiliza `UsersService` (M02) y `ReportsService` (M06).

### M06 · `reports/` *(scaffold)*
- **services**: `reports.service` (`providedIn: 'root'`) · **models**: `reports.ts`
- Pendiente: dashboard dedicado, export CSV/PDF, reportes filtrados/programados. Ver `reports/README.md`.

### M07 · `search/` *(scaffold)*
- Hoy los filtros viven inline en `users/admin-users` y `sports-disabilities/events-page`.
  Hogar previsto para extraerlos. Ver `search/README.md`.

### M08 · `assistant/`
- **pages**: `assistant-page`, `trainer-dashboard`, `sessions-page`
- **services**: `ai-assistant`, `assistant-ui`, `chat`, `competition-progress`
- **models**: `chat.ts`, `competition.ts`, `body-map.ts`
- `ai-assistant-widget` y `body-map` (componentes) se quedan en `@shared/components/`
  porque los consume `AppComponent` y páginas de varios módulos.

### M09 · `subscriptions/` *(scaffold)*
- Sin implementación. Ver `subscriptions/README.md` (RF54–RF68).

## Qué quedó en `core/` y `shared/`

- **`core/`** = infraestructura app-wide sin dominio: `config/api.config`,
  `guards/`, `interceptors/auth.interceptor`, `services/{session,google-maps-loader}`,
  `models/{app-role,user-profile}` (contratos de identidad que necesitan session/guards),
  `utils/{jwt,qr-attendance}` (`qr-attendance` incluye `isSafeReturnUrl`, usado por 3 guards).
- **`shared/`** = UI reutilizable sin dominio: los 9 componentes (incluido `panel-shell`,
  ahora aquí), `pipes/`, `icons/`, `styles/panel-common.scss`, `services/confirm-dialog.service`.

## Alias de imports (`tsconfig.json` → `paths`)

- `@core/*` → `src/app/core/*`
- `@shared/*` → `src/app/shared/*`
- `@features/*` → `src/app/features/*`

Regla: imports **entre** módulos/capas usan alias; imports **dentro** de un componente o
de un mismo sub-árbol (`./`, `../models/x` colindante) siguen relativos.

## Decisiones de ubicación discutibles (ajustables)

| Elemento | Aquí | Alternativa | Motivo |
|---|---|---|---|
| `aptitude-quiz-page`, `quiz.service` | M02 | M05 | Verificación de rol de usuario (RF10) |
| `athletes-page` | M02 | M03 / M07 | Padrón/asistencia de usuarios |
| `organizer-dashboard` | M03 | área propia | Gestión de eventos (RF19/RF20) |
| `trainer-dashboard`, `sessions-page` | M08 | M03 | Métricas/alertas de entrenador y rutinas (RF46/RF53) |
| `admin-user-detail` | M02 | M05 | CRUD/bloqueo de un usuario (RF09/RF28) |
| `user-profile.ts`, `app-role.ts` | `core/models` | M02 | Los consumen `SessionService` y los guards |
| `qr-attendance.util.ts` | `core/utils` | M02 | `isSafeReturnUrl` lo usan 3 guards de `core/` |
| `disability-type.ts` | `auth/models` | M03 | Único consumidor: alta de M01 |
| `panel-shell` | `shared/components` | `panel/` | `<app-panel-shell>` lo usan las páginas de todos los feature modules |
