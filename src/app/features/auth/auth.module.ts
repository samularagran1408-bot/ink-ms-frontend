import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { StartInterfaceComponent } from './pages/start-interface/start-interface.component';
import { GuestHomeComponent } from './pages/guest-home/guest-home.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';


@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    StartInterfaceComponent,
    GuestHomeComponent,
    ForgotPasswordComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    AuthRoutingModule
  ]
})
export class AuthModule { }
