import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Group } from '../../models/group.model';
import { Firestore, collection, addDoc, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { AuthService } from '../../services/Authentication Services/auth.service';

@Component({
  selector: 'app-add-group',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './add-group.component.html',
  styleUrls: ['./add-group.component.scss']
})
export class AddGroupComponent implements OnInit {
  @Input() group: Group | null = null;
  @Input() currentUserRole: string = 'HOD';
  @Input() departmentName: string = '';

  groupForm!: FormGroup;
  submitted = false;
  isSubmitting = false;
  errorMessage = '';
  isEditMode = false;

  // Options for form fields
  groupTypes = [
    { value: 'Annual', label: 'Annual' },
    { value: 'Semester', label: 'Semester' }
  ];

  streamTypes = [
    { value: 'ECP', label: 'Extended Curriculum Programme (ECP)' },
    { value: 'Main', label: 'Main Stream' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.group;
    this.initializeForm();
  }

  initializeForm() {
    this.groupForm = this.formBuilder.group({
      name: [this.group?.name || '', [Validators.required, Validators.minLength(2)]],
      program: [this.group?.program || '', [Validators.required, Validators.minLength(2)]],
      groupType: [this.group?.groupType || '', Validators.required],
      stream: ['', Validators.required],
      yearLevel: ['', Validators.required],
      size: [this.group?.size || null, [Validators.required, Validators.min(1), Validators.max(200)]],
      year: [this.group?.year || 1],
      semester: [this.group?.semester || 1]
    });

    // Update form validations when stream changes
    this.groupForm.get('stream')?.valueChanges.subscribe(streamValue => {
      this.updateYearLevelOptions(streamValue);
    });

    // Update year when yearLevel changes
    this.groupForm.get('yearLevel')?.valueChanges.subscribe(yearLevelValue => {
      if (yearLevelValue) {
        const yearMatch = yearLevelValue.match(/Year (\d+)/);
        if (yearMatch) {
          this.groupForm.patchValue({ year: parseInt(yearMatch[1]) });
        }
      }
    });
  }

  updateYearLevelOptions(streamType: string) {
    const yearLevelControl = this.groupForm.get('yearLevel');
    if (streamType === 'ECP') {
      yearLevelControl?.setValue('Year 1');
    } else {
      yearLevelControl?.setValue('');
    }
  }

  getYearLevelOptions(): string[] {
    const streamType = this.groupForm.get('stream')?.value;
    const groupType = this.groupForm.get('groupType')?.value;

    if (streamType === 'ECP') {
      return ['Year 1'];
    } else if (streamType === 'Main') {
      if (groupType === 'Annual') {
        return ['Year 1', 'Year 2', 'Year 3'];
      } else {
        return ['Year 1 (S1 and S2)', 'Year 2 (S1 and S2)', 'Year 3 (S1 and S2)'];
      }
    }
    return [];
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.groupForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.submitted));
  }

  getFieldError(fieldName: string): string {
    const field = this.groupForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['min']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['min'].min}`;
      }
      if (field.errors['max']) {
        return `${this.getFieldLabel(fieldName)} cannot exceed ${field.errors['max'].max}`;
      }
    }
    return '';
  }

  getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Group Name',
      program: 'Program Name',
      groupType: 'Group Type',
      stream: 'Stream Type',
      yearLevel: 'Year Level',
      size: 'Group Size'
    };
    return labels[fieldName] || fieldName;
  }

  async onSubmit() {
    this.submitted = true;
    this.errorMessage = '';

    if (this.groupForm.invalid) {
      console.log('Form is invalid:', this.groupForm.errors);
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.groupForm.value;
      
      const groupData: any = {
        name: formValue.name,
        program: formValue.program,
        year: formValue.year,
        semester: formValue.semester,
        size: formValue.size,
        groupType: formValue.groupType,
        studentCount: 0, // Default value
        createdAt: this.isEditMode ? this.group!.createdAt : new Date(),
        updatedAt: serverTimestamp()
      };

      if (this.isEditMode) {
        // Update existing group
        const groupDocRef = doc(this.firestore, 'groups', this.group!.id.toString());
        await updateDoc(groupDocRef, groupData);
      } else {
        // Add new group
        const groupsCollectionRef = collection(this.firestore, 'groups');
        await addDoc(groupsCollectionRef, groupData);
      }

      await this.modalController.dismiss(groupData, 'confirm');
    } catch (error: any) {
      console.error('Error saving group:', error);
      this.errorMessage = error.message || 'An error occurred while saving the group';
    } finally {
      this.isSubmitting = false;
    }
  }

  async cancel() {
    await this.modalController.dismiss(null, 'cancel');
  }
}
