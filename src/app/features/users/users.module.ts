import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { UserInterfaceComponent } from './pages/user-interface/user-interface.component';
import { ProfilePageComponent } from './pages/profile-page/profile-page.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminUserDetailComponent } from './pages/admin-user-detail/admin-user-detail.component';
import { AthletesPageComponent } from './pages/athletes-page/athletes-page.component';
import { AttendanceCheckinPageComponent } from './pages/attendance-checkin-page/attendance-checkin-page.component';
import { AptitudeQuizPageComponent } from './pages/aptitude-quiz-page/aptitude-quiz-page.component';

/**
 * M02 - Usuarios.
 * Perfil, gestion/listado/detalle de usuarios, padron de atletas, asistencias
 * y verificacion de rol (quiz de aptitud). Ver features/MODULES.md.
 */
@NgModule({
  declarations: [
    UserInterfaceComponent,
    ProfilePageComponent,
    AdminUsersComponent,
    AdminUserDetailComponent,
    AthletesPageComponent,
    AttendanceCheckinPageComponent,
    AptitudeQuizPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    UserInterfaceComponent,
    ProfilePageComponent,
    AdminUsersComponent,
    AdminUserDetailComponent,
    AthletesPageComponent,
    AttendanceCheckinPageComponent,
    AptitudeQuizPageComponent
  ]
})
export class UsersModule {}
