import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HodDashPage } from './hod-dash.page';

const routes: Routes = [
  {
    path: '',
    component: HodDashPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HodDashPageRoutingModule {}
