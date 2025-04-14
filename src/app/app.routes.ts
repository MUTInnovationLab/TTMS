import { Routes } from '@angular/router';
import { AdminDashPage } from './admin-dash/admin-dash.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin-dash',
    pathMatch: 'full',
  },
  {
    path: 'admin-dash',
    component: AdminDashPage
  },
  // ...existing routes...
];
