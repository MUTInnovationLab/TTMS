import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TimetableGridComponent } from './timetable-grid.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TimetableGridComponent  // Import the standalone component instead of declaring it
  ],
  exports: [TimetableGridComponent]  // Export it for use in other modules
})
export class TimetableGridModule { }
