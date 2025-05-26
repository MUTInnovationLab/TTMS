import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AdminDashPageRoutingModule } from './admin-dash-routing.module';
import { AdminDashPage } from './admin-dash.page';
import { SharedModule } from '../components/shared/shared.module';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SidebarService } from '../services/Utility Services/sidebar.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminDashPageRoutingModule,
    SharedModule
  ],
  providers: [SidebarService],
  declarations: [AdminDashPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Needed for any custom elements
})
export class AdminDashPageModule {}
