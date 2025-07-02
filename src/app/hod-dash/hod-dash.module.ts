import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http'; // Add this import

import { HodDashPageRoutingModule } from './hod-dash-routing.module';
import { HodDashPage } from './hod-dash.page';
import { SharedModule } from '../components/shared/shared.module';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TimetableGridComponent } from '../components/timetable-grid/timetable-grid.component';
import { VenueAvailComponent } from '../components/venue-avail/venue-avail.component';
import { ConflictResComponent } from '../components/conflict-res/conflict-res.component';

// Import Firebase modules
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HodDashPageRoutingModule,
    SharedModule,
    TimetableGridComponent,
    VenueAvailComponent,
    ConflictResComponent,
    AngularFirestoreModule,
    AngularFireAuthModule,
    HttpClientModule  // Add this to imports array
  ],
  declarations: [HodDashPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add schema support for custom elements
})
export class HodDashPageModule {}
