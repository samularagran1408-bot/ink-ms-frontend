import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { StartInterfaceComponent } from './pages/start-interface/start-interface.component';
import { GuestHomeComponent } from './pages/guest-home/guest-home.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { TermsPageComponent } from './pages/terms-page/terms-page.component';
import { SupportPageComponent } from './pages/support-page/support-page.component';

const routes: Routes = [
  { path: '', component: GuestHomeComponent },
  { path: 'welcome', component: StartInterfaceComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'guest', redirectTo: '', pathMatch: 'full' },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'terminos', component: TermsPageComponent },
  { path: 'soporte', component: SupportPageComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
