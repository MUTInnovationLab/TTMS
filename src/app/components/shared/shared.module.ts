import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TimetableGridModule } from '../timetable-grid/timetable-grid.module';
import { ConflictResComponent } from '../conflict-res/conflict-res.component';
import { VenueAvailComponent } from '../venue-avail/venue-avail.component';
import { ReportsComponent } from '../reports/reports.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TimetableGridModule,
    ConflictResComponent,  // Import standalone component
    VenueAvailComponent,   // Import standalone component
    ReportsComponent       // Import standalone reports component
  ],
  exports: [
    // Export modules and components for use in feature modules
    CommonModule,
    FormsModule,
    IonicModule,
    TimetableGridModule,
    ConflictResComponent,
    VenueAvailComponent,
    ReportsComponent       // Export reports component
  ]
})
export class SharedModule {}
