import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HodDashPage } from './hod-dash.page';

import { AddGroupPage } from './add-group/add-group.page';
import { GroupDetailPage } from './group-detail/group-detail.page';

const routes: Routes = [
  {
    path: '',
    component: HodDashPage
  },
  {
    path: 'add-group',
    component: AddGroupPage
  },
  {
    path: 'group-detail/:id',
    component: GroupDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HodDashPageRoutingModule {}
