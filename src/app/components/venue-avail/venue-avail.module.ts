import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { VenueAvailComponent } from './venue-avail.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VenueAvailComponent // Import as standalone component
  ],
  exports: [
    VenueAvailComponent
  ]
})
export class VenueAvailModule { }
