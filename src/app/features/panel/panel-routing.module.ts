import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from '@core/guards/auth.guard';
import { RoleGuard } from '@core/guards/role.guard';
import { QuizCompletedGuard } from '@core/guards/quiz-completed.guard';
import { SharedModule } from '@shared/shared.module';
import { PanelShellComponent } from '@shared/components/panel-shell/panel-shell.component';

const accountChildren: Routes = [
  {
    path: 'profile',
    loadComponent: () =>
      import('@features/users/pages/profile-page/profile-page.component').then((m) => m.ProfilePageComponent)
  },
  {
    path: 'accessibility',
    loadComponent: () =>
      import('@features/accessibility/pages/accessibility-page/accessibility-page.component').then(
        (m) => m.AccessibilityPageComponent
      )
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('@features/accessibility/pages/notifications-page/notifications-page.component').then(
        (m) => m.NotificationsPageComponent
      )
  }
];

const routes: Routes = [
  {
    path: 'asistencia',
    loadComponent: () =>
      import('@features/users/pages/attendance-checkin-page/attendance-checkin-page.component').then(
        (m) => m.AttendanceCheckinPageComponent
      ),
    canActivate: [AuthGuard]
  },
  {
    path: 'home',
    component: PanelShellComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['USUARIO', 'ADMIN', 'ENTRENADOR', 'ORGANIZADOR'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/users/pages/user-interface/user-interface.component').then((m) => m.UserInterfaceComponent)
      },
      {
        path: 'events',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/events-page/events-page.component').then(
            (m) => m.EventsPageComponent
          ),
        data: { mode: 'user' }
      },
      {
        path: 'asistente',
        loadComponent: () =>
          import('@features/assistant/pages/assistant-page/assistant-page.component').then(
            (m) => m.AssistantPageComponent
          )
      },
      {
        path: 'crew',
        loadComponent: () =>
          import('@features/assistant/pages/crew-page/crew-page.component').then((m) => m.CrewPageComponent)
      },
      ...accountChildren
    ]
  },
  {
    path: 'admin',
    component: PanelShellComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/admin/pages/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          )
      },
      {
        path: 'asistente',
        loadComponent: () =>
          import('@features/assistant/pages/assistant-page/assistant-page.component').then(
            (m) => m.AssistantPageComponent
          )
      },
      {
        path: 'crew',
        loadComponent: () =>
          import('@features/assistant/pages/crew-page/crew-page.component').then((m) => m.CrewPageComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('@features/users/pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent)
      },
      {
        path: 'users/:email',
        loadComponent: () =>
          import('@features/users/pages/admin-user-detail/admin-user-detail.component').then(
            (m) => m.AdminUserDetailComponent
          )
      },
      {
        path: 'events',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/events-page/events-page.component').then(
            (m) => m.EventsPageComponent
          ),
        data: { mode: 'manage' }
      },
      {
        path: 'athletes',
        loadComponent: () =>
          import('@features/users/pages/athletes-page/athletes-page.component').then((m) => m.AthletesPageComponent)
      },
      {
        path: 'sports',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/sports-page/sports-page.component').then(
            (m) => m.SportsPageComponent
          )
      },
      {
        path: 'disabilities',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/disabilities-page/disabilities-page.component').then(
            (m) => m.DisabilitiesPageComponent
          )
      },
      {
        path: 'associations',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/associations-page/associations-page.component').then(
            (m) => m.AssociationsPageComponent
          )
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('@features/admin/pages/admin-roles/admin-roles.component').then((m) => m.AdminRolesComponent)
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('@features/admin/pages/admin-audit/admin-audit.component').then((m) => m.AdminAuditComponent)
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('@features/subscriptions/pages/organizer-plans/organizer-plans.component').then(
            (m) => m.OrganizerPlansComponent
          )
      },
      ...accountChildren
    ]
  },
  {
    path: 'trainer',
    component: PanelShellComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ENTRENADOR', 'ADMIN'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/assistant/pages/trainer-dashboard/trainer-dashboard.component').then(
            (m) => m.TrainerDashboardComponent
          )
      },
      {
        path: 'asistente',
        loadComponent: () =>
          import('@features/assistant/pages/assistant-page/assistant-page.component').then(
            (m) => m.AssistantPageComponent
          )
      },
      {
        path: 'crew',
        loadComponent: () =>
          import('@features/assistant/pages/crew-page/crew-page.component').then((m) => m.CrewPageComponent)
      },
      {
        path: 'quiz',
        loadComponent: () =>
          import('@features/users/pages/aptitude-quiz-page/aptitude-quiz-page.component').then(
            (m) => m.AptitudeQuizPageComponent
          ),
        data: { quizRolePath: 'trainer' }
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('@features/assistant/pages/sessions-page/sessions-page.component').then(
            (m) => m.SessionsPageComponent
          ),
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'sports',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/sports-page/sports-page.component').then(
            (m) => m.SportsPageComponent
          ),
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'disabilities',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/disabilities-page/disabilities-page.component').then(
            (m) => m.DisabilitiesPageComponent
          ),
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      {
        path: 'associations',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/associations-page/associations-page.component').then(
            (m) => m.AssociationsPageComponent
          ),
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ENTRENADOR' }
      },
      ...accountChildren
    ]
  },
  {
    path: 'organizer',
    component: PanelShellComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ORGANIZADOR', 'ADMIN'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/organizer-dashboard/organizer-dashboard.component').then(
            (m) => m.OrganizerDashboardComponent
          )
      },
      {
        path: 'asistente',
        loadComponent: () =>
          import('@features/assistant/pages/assistant-page/assistant-page.component').then(
            (m) => m.AssistantPageComponent
          )
      },
      {
        path: 'crew',
        loadComponent: () =>
          import('@features/assistant/pages/crew-page/crew-page.component').then((m) => m.CrewPageComponent)
      },
      {
        path: 'quiz',
        loadComponent: () =>
          import('@features/users/pages/aptitude-quiz-page/aptitude-quiz-page.component').then(
            (m) => m.AptitudeQuizPageComponent
          ),
        data: { quizRolePath: 'organizer' }
      },
      {
        path: 'events',
        loadComponent: () =>
          import('@features/sports-disabilities/pages/events-page/events-page.component').then(
            (m) => m.EventsPageComponent
          ),
        canActivate: [QuizCompletedGuard],
        data: { mode: 'manage', quizRole: 'ORGANIZADOR' }
      },
      {
        path: 'athletes',
        loadComponent: () =>
          import('@features/users/pages/athletes-page/athletes-page.component').then((m) => m.AthletesPageComponent),
        canActivate: [QuizCompletedGuard],
        data: { quizRole: 'ORGANIZADOR' }
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('@features/subscriptions/pages/organizer-plans/organizer-plans.component').then(
            (m) => m.OrganizerPlansComponent
          )
      },
      {
        path: 'subscription',
        loadComponent: () =>
          import('@features/subscriptions/pages/subscription/subscription.component').then(
            (m) => m.SubscriptionComponent
          )
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('@features/subscriptions/pages/payment-history/payment-history.component').then(
            (m) => m.PaymentHistoryComponent
          )
      },
      {
        path: 'payments/receipt',
        loadComponent: () =>
          import('@features/subscriptions/pages/proof-of-payment/proof-of-payment.component').then(
            (m) => m.ProofOfPaymentComponent
          )
      },
      ...accountChildren
    ]
  }
];

@NgModule({
  imports: [SharedModule, RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PanelRoutingModule {}
