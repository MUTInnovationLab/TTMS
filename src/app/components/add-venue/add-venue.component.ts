import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular'; // Added ToastController
import { VenueService } from '../../services/Entity Management Services/venue.service';
import { CommonModule } from '@angular/common'; 
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-add-venue',
  templateUrl: './add-venue.component.html',
  styleUrls: ['./add-venue.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class AddVenueComponent implements OnInit {
  venueForm: FormGroup;
  submitted = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    public modalController: ModalController,
    private venueService: VenueService,
    private toastController: ToastController // Injected ToastController
  ) {
    this.venueForm = this.fb.group({
      name: ['', Validators.required],
      siteName: ['', Validators.required],
      id: ['', Validators.required],
      defaultCapacity: ['', [Validators.required, Validators.min(1)]],
      type: ['', Validators.required],
      hasProjector: [false],
      hasWhiteboard: [false],
      hasSmartboard: [false],
      hasComputers: [false],
      computerCount: [{ value: '', disabled: true }, Validators.min(1)]
    });
  }

  ngOnInit() {
    this.venueForm.get('hasComputers')?.valueChanges.subscribe(hasComputers => {
      const computerCount = this.venueForm.get('computerCount');
      if (hasComputers) {
        computerCount?.enable();
      } else {
        computerCount?.disable();
        computerCount?.setValue('');
      }
    });
  }

  get f() { return this.venueForm.controls; }

  async onSubmit() {
    this.submitted = true;
    if (this.venueForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    const venueData = {
      name: this.venueForm.value.name,
      siteName: this.venueForm.value.siteName,
      id: this.venueForm.value.id,
      defaultCapacity: Number(this.venueForm.value.defaultCapacity),
      type: this.venueForm.value.type,
      hasProjector: this.venueForm.value.hasProjector,
      hasWhiteboard: this.venueForm.value.hasWhiteboard,
      hasSmartboard: this.venueForm.value.hasSmartboard,
      hasComputers: this.venueForm.value.hasComputers,
      computerCount: this.venueForm.value.hasComputers ? this.venueForm.value.computerCount : null,
      autoSchedulable: false,
      schedulable: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deafLoop: false,
      area: '',
      charge: '',
      department: '',
      roomId: Math.floor(Math.random() * 1000),
      staff1Name: '',
      staff2Name: '',
      tags: ['1'],
      telephone: '',
      website: '',
      wheelchairAccess: false
    };

    try {
      await this.venueService.addVenue(venueData);
      
      // Show success toast
      const toast = await this.toastController.create({
        message: 'Venue added successfully!',
        duration: 2000, // Show for 2 seconds
        color: 'success',
        position: 'top',
        icon: 'checkmark-circle',
        cssClass: 'success-toast'
      });
      
      await toast.present();
      
      // Wait for toast to complete before closing modal
      await toast.onDidDismiss();
      this.modalController.dismiss();
      
    } catch (error: any) {
      this.errorMessage = 'Failed to add venue: ' + error.message;
      console.error('Firestore error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  dismissModal() {
    this.modalController.dismiss();
  }
}