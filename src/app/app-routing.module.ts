import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  { path: '', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  {
    path: 'pagos/exito',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/subscriptions/pages/payment-result/payment-result.component').then(
        (m) => m.PaymentResultComponent
      ),
    data: { status: 'exito' }
  },
  {
    path: 'pagos/pendiente',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/subscriptions/pages/payment-result/payment-result.component').then(
        (m) => m.PaymentResultComponent
      ),
    data: { status: 'pendiente' }
  },
  {
    path: 'pagos/error',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/subscriptions/pages/payment-result/payment-result.component').then(
        (m) => m.PaymentResultComponent
      ),
    data: { status: 'error' }
  },
  { path: '', loadChildren: () => import('./features/panel/panel.module').then(m => m.PanelModule) },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
