import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { PanelRoutingModule } from './panel-routing.module';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminUserDetailComponent } from './pages/admin-user-detail/admin-user-detail.component';
import { AdminRolesComponent } from './pages/admin-roles/admin-roles.component';
import { AdminAuditComponent } from './pages/admin-audit/admin-audit.component';
import { EventsPageComponent } from './pages/events-page/events-page.component';
import { SportsPageComponent } from './pages/sports-page/sports-page.component';
import { DisabilitiesPageComponent } from './pages/disabilities-page/disabilities-page.component';
import { ProfilePageComponent } from './pages/profile-page/profile-page.component';
import { AccessibilityPageComponent } from './pages/accessibility-page/accessibility-page.component';
import { TrainerDashboardComponent } from './pages/trainer-dashboard/trainer-dashboard.component';
import { SessionsPageComponent } from './pages/sessions-page/sessions-page.component';
import { OrganizerDashboardComponent } from './pages/organizer-dashboard/organizer-dashboard.component';
import { AthletesPageComponent } from './pages/athletes-page/athletes-page.component';
import { AssociationsPageComponent } from './pages/associations-page/associations-page.component';
import { NotificationsPageComponent } from './pages/notifications-page/notifications-page.component';
import { PanelShellComponent } from './components/panel-shell/panel-shell.component';
import { UserInterfaceComponent } from '../auth/pages/user-interface/user-interface.component';
import { AptitudeQuizPageComponent } from './pages/aptitude-quiz-page/aptitude-quiz-page.component';
import { AttendanceCheckinPageComponent } from './pages/attendance-checkin-page/attendance-checkin-page.component';
import { AssistantPageComponent } from './pages/assistant-page/assistant-page.component';
import { CrewPageComponent } from './pages/crew-page/crew-page.component';

@NgModule({
  declarations: [
    PanelShellComponent,
    UserInterfaceComponent,
    AdminDashboardComponent,
    AdminUsersComponent,
    AdminUserDetailComponent,
    AdminRolesComponent,
    AdminAuditComponent,
    EventsPageComponent,
    SportsPageComponent,
    DisabilitiesPageComponent,
    AssociationsPageComponent,
    ProfilePageComponent,
    AccessibilityPageComponent,
    NotificationsPageComponent,
    TrainerDashboardComponent,
    SessionsPageComponent,
    OrganizerDashboardComponent,
    AthletesPageComponent,
    AptitudeQuizPageComponent,
    AttendanceCheckinPageComponent,
    AssistantPageComponent,
    CrewPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    PanelRoutingModule
  ]
})
export class PanelModule {}
