import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';

import { AdminDashPageRoutingModule } from './admin-dash-routing.module';
import { AdminDashPage } from './admin-dash.page';
import { SharedModule } from '../components/shared/shared.module';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SidebarService } from '../services/Utility Services/sidebar.service';

// New Firebase v9+ imports for components that need Firestore
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminDashPageRoutingModule,
    SharedModule,
    AngularFirestoreModule,
    AngularFireAuthModule
  ],
  declarations: [AdminDashPage],
  providers: [
    SidebarService
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Needed for any custom elements
})
export class AdminDashPageModule {}
