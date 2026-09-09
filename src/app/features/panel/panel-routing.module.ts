import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from '@core/guards/auth.guard';
import { RoleGuard } from '@core/guards/role.guard';
import { QuizCompletedGuard } from '@core/guards/quiz-completed.guard';
// Componentes de pagina agrupados por modulo de producto (M01-M09).
// Ver features/MODULES.md para el mapa carpeta <-> modulo <-> RF.
import { UserInterfaceComponent } from '@features/users/pages/user-interface/user-interface.component';
import { ProfilePageComponent } from '@features/users/pages/profile-page/profile-page.component';
import { AdminUsersComponent } from '@features/users/pages/admin-users/admin-users.component';
import { AdminUserDetailComponent } from '@features/users/pages/admin-user-detail/admin-user-detail.component';
import { AthletesPageComponent } from '@features/users/pages/athletes-page/athletes-page.component';
import { AttendanceCheckinPageComponent } from '@features/users/pages/attendance-checkin-page/attendance-checkin-page.component';
import { AptitudeQuizPageComponent } from '@features/users/pages/aptitude-quiz-page/aptitude-quiz-page.component';
import { SportsPageComponent } from '@features/sports-disabilities/pages/sports-page/sports-page.component';
import { DisabilitiesPageComponent } from '@features/sports-disabilities/pages/disabilities-page/disabilities-page.component';
import { AssociationsPageComponent } from '@features/sports-disabilities/pages/associations-page/associations-page.component';
import { EventsPageComponent } from '@features/sports-disabilities/pages/events-page/events-page.component';
import { OrganizerDashboardComponent } from '@features/sports-disabilities/pages/organizer-dashboard/organizer-dashboard.component';
import { AccessibilityPageComponent } from '@features/accessibility/pages/accessibility-page/accessibility-page.component';
import { NotificationsPageComponent } from '@features/accessibility/pages/notifications-page/notifications-page.component';
import { AdminDashboardComponent } from '@features/admin/pages/admin-dashboard/admin-dashboard.component';
import { AdminRolesComponent } from '@features/admin/pages/admin-roles/admin-roles.component';
import { AdminAuditComponent } from '@features/admin/pages/admin-audit/admin-audit.component';
import { AssistantPageComponent } from '@features/assistant/pages/assistant-page/assistant-page.component';
import { TrainerDashboardComponent } from '@features/assistant/pages/trainer-dashboard/trainer-dashboard.component';
import { SessionsPageComponent } from '@features/assistant/pages/sessions-page/sessions-page.component';
import { OrganizerPlansComponent } from '@features/subscriptions/pages/organizer-plans/organizer-plans.component';
import { SubscriptionComponent } from '@features/subscriptions/pages/subscription/subscription.component';
import { PaymentHistoryComponent } from '@features/subscriptions/pages/payment-history/payment-history.component';
import { ProofOfPaymentComponent } from '@features/subscriptions/pages/proof-of-payment/proof-of-payment.component';

const accountChildren = [
  { path: 'profile', component: ProfilePageComponent },
  { path: 'accessibility', component: AccessibilityPageComponent },
  { path: 'notifications', component: NotificationsPageComponent }
];

const routes: Routes = [
  {
    path: 'asistencia',
    component: AttendanceCheckinPageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'home',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['USUARIO', 'ADMIN', 'ENTRENADOR', 'ORGANIZADOR'] },
    children: [
      { path: '', component: UserInterfaceComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'user' } },
      { path: 'asistente', component: AssistantPageComponent },
      ...accountChildren
    ]
  },
  {
    path: 'admin',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'asistente', component: AssistantPageComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'users/:email', component: AdminUserDetailComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'manage' } },
      { path: 'athletes', component: AthletesPageComponent },
      { path: 'sports', component: SportsPageComponent },
      { path: 'disabilities', component: DisabilitiesPageComponent },
      { path: 'associations', component: AssociationsPageComponent },
      { path: 'roles', component: AdminRolesComponent },
      { path: 'audit', component: AdminAuditComponent },
      { path: 'subscriptions', component: OrganizerPlansComponent },
      ...accountChildren
    ]
  },
  {
    path: 'trainer',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ENTRENADOR', 'ADMIN'] },
    children: [
      { path: '', component: TrainerDashboardComponent },
      { path: 'asistente', component: AssistantPageComponent },
      {
        path: 'quiz',
        component: AptitudeQuizPageComponent,
        data: { quizRolePath: 'trainer' }
      },
      {
        path: 'sessions',
        component: SessionsPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'sports',
        component: SportsPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'disabilities',
        component: DisabilitiesPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'associations',
        component: AssociationsPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      ...accountChildren
    ]
  },
  {
    path: 'organizer',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ORGANIZADOR', 'ADMIN'] },
    children: [
      { path: '', component: OrganizerDashboardComponent },
      { path: 'asistente', component: AssistantPageComponent },
      {
        path: 'quiz',
        component: AptitudeQuizPageComponent,
        data: { quizRolePath: 'organizer' }
      },
      {
        path: 'events',
        component: EventsPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { mode: 'manage', quizRole: 'ORGANIZADOR' }
      },
      {
        path: 'athletes',
        component: AthletesPageComponent,
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ORGANIZADOR' }
      },
      { path: 'plans', component: OrganizerPlansComponent },
      { path: 'subscription', component: SubscriptionComponent },
      { path: 'payments', component: PaymentHistoryComponent },
      { path: 'payments/receipt', component: ProofOfPaymentComponent },
      ...accountChildren
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PanelRoutingModule {}
