import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { UserInterfaceComponent } from '../auth/pages/user-interface/user-interface.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminRolesComponent } from './pages/admin-roles/admin-roles.component';
import { AdminAuditComponent } from './pages/admin-audit/admin-audit.component';
import { EventsPageComponent } from './pages/events-page/events-page.component';
import { SportsPageComponent } from './pages/sports-page/sports-page.component';
import { DisabilitiesPageComponent } from './pages/disabilities-page/disabilities-page.component';
import { ProfilePageComponent } from './pages/profile-page/profile-page.component';
import { AccessibilityPageComponent } from './pages/accessibility-page/accessibility-page.component';
import { NotificationsPageComponent } from './pages/notifications-page/notifications-page.component';
import { TrainerDashboardComponent } from './pages/trainer-dashboard/trainer-dashboard.component';
import { SessionsPageComponent } from './pages/sessions-page/sessions-page.component';
import { OrganizerDashboardComponent } from './pages/organizer-dashboard/organizer-dashboard.component';
import { AthletesPageComponent } from './pages/athletes-page/athletes-page.component';

const accountChildren = [
  { path: 'profile', component: ProfilePageComponent },
  { path: 'accessibility', component: AccessibilityPageComponent },
  { path: 'notifications', component: NotificationsPageComponent }
];

const routes: Routes = [
  {
    path: 'home',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['USUARIO', 'ADMIN', 'ENTRENADOR', 'ORGANIZADOR'] },
    children: [
      { path: '', component: UserInterfaceComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'user' } },
      ...accountChildren
    ]
  },
  {
    path: 'admin',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'manage' } },
      { path: 'athletes', component: AthletesPageComponent },
      { path: 'sports', component: SportsPageComponent },
      { path: 'disabilities', component: DisabilitiesPageComponent },
      { path: 'roles', component: AdminRolesComponent },
      { path: 'audit', component: AdminAuditComponent },
      ...accountChildren
    ]
  },
  {
    path: 'trainer',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ENTRENADOR', 'ADMIN'] },
    children: [
      { path: '', component: TrainerDashboardComponent },
      { path: 'sessions', component: SessionsPageComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'manage' } },
      { path: 'athletes', component: AthletesPageComponent },
      ...accountChildren
    ]
  },
  {
    path: 'organizer',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ORGANIZADOR', 'ADMIN'] },
    children: [
      { path: '', component: OrganizerDashboardComponent },
      { path: 'events', component: EventsPageComponent, data: { mode: 'manage' } },
      { path: 'athletes', component: AthletesPageComponent },
      ...accountChildren
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PanelRoutingModule {}
