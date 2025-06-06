import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StudentPageRoutingModule } from './student-routing.module';
import { TimetableGridModule } from '../components/timetable-grid/timetable-grid.module';

import { StudentPage } from './student.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StudentPageRoutingModule,
    TimetableGridModule
  ],
  declarations: [StudentPage]
})
export class StudentPageModule {}
