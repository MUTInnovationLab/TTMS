import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TimetableGridComponent } from './timetable-grid.component';

// Firebase v9+ imports
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TimetableGridComponent  // Import the standalone component instead of declaring it
  ],
  providers: [
    // Provide Firebase v9+ services for the standalone component
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore())
  ],
  exports: [TimetableGridComponent]  // Export it for use in other modules
})
export class TimetableGridModule { }
