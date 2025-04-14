import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HodDashPageRoutingModule } from './hod-dash-routing.module';
import { HodDashPage } from './hod-dash.page';
import { SharedModule } from '../components/shared/shared.module';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TimetableGridComponent } from '../components/timetable-grid/timetable-grid.component';
import { VenueAvailComponent } from '../components/venue-avail/venue-avail.component';
import { ConflictResComponent } from '../components/conflict-res/conflict-res.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HodDashPageRoutingModule,
    SharedModule,
    TimetableGridComponent,
    VenueAvailComponent,
    ConflictResComponent
  ],
  declarations: [HodDashPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add schema support for custom elements
})
export class HodDashPageModule {}
