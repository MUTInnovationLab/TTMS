import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Department } from '../../interfaces/department.interface';

@Component({
  selector: 'app-add-department',
  templateUrl: './add-department.component.html',
  styleUrls: ['./add-department.component.scss'],
  standalone: false,
})
export class AddDepartmentComponent implements OnInit {
  @Input() department: Department | null = null;
  @Input() currentUserRole: string = 'Admin';

  departmentForm: FormGroup;
  isEditMode: boolean = false;
  isSubmitting: boolean = false;
  currentYear: number = new Date().getFullYear();

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private toastController: ToastController
  ) {
    this.departmentForm = this.createForm();
  }

  ngOnInit() {
    this.isEditMode = !!this.department;
    
    if (this.isEditMode && this.department) {
      this.populateForm();
    }
  }

  private createForm(): FormGroup {
    return this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(10), Validators.pattern(/^[A-Z0-9]+$/)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      location: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      phone: ['', [Validators.required, Validators.pattern(/^[\+]?[0-9\s\-\(\)]{8,20}$/)]],
      email: ['', [Validators.required, Validators.email]],
      budget: [0, [Validators.min(0)]],
      establishedYear: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear())]],
      status: ['active', Validators.required]
    });
  }

  private populateForm() {
    if (this.department) {
      this.departmentForm.patchValue({
        name: this.department.name,
        code: this.department.code,
        description: this.department.description,
        location: this.department.location,
        phone: this.department.phone,
        email: this.department.email,
        budget: this.department.budget || 0,
        establishedYear: this.department.establishedYear,
        status: this.department.status
      });
    }
  }

  async onSubmit() {
    if (this.departmentForm.valid) {
      this.isSubmitting = true;

      const formData = this.departmentForm.value;
      
      const departmentData: Department = {
        ...formData,
        code: formData.code.toUpperCase(),
        createdAt: this.isEditMode ? this.department?.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (this.isEditMode && this.department) {
        departmentData.id = this.department.id;
      }

      try {
        // Close modal with the department data
        await this.modalController.dismiss({
          department: departmentData,
          action: this.isEditMode ? 'edit' : 'create'
        });
        
        this.presentToast(
          this.isEditMode ? 'Department updated successfully!' : 'Department created successfully!'
        );
      } catch (error) {
        console.error('Error submitting department:', error);
        this.presentToast('Error saving department. Please try again.', 'danger');
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.markFormGroupTouched();
      this.presentToast('Please fill in all required fields correctly.', 'warning');
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.departmentForm.controls).forEach(key => {
      const control = this.departmentForm.get(key);
      control?.markAsTouched();
    });
  }

  async cancel() {
    await this.modalController.dismiss();
  }

  private async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.departmentForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.departmentForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['pattern']) return 'Please enter a valid format';
      if (field.errors['min']) return 'Value is too small';
      if (field.errors['max']) return 'Value is too large';
    }
    return '';
  }
}
