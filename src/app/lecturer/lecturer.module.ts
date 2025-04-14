import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { LecturerPage } from './lecturer.page';
import { TimetableGridModule } from '../components/timetable-grid/timetable-grid.module';
import { VenueAvailModule } from '../components/venue-avail/venue-avail.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TimetableGridModule,
    VenueAvailModule,
    RouterModule.forChild([
      {
        path: '',
        component: LecturerPage
      }
    ])
  ],  
  declarations: [LecturerPage], // Keep this since the component is not standalone
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // This is already in place to handle custom elements
})
export class LecturerPageModule {}
