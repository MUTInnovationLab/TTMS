import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ModuleService, Module } from '../../services/Entity Management Services/module.service';
import { AuthService } from '../../services/Authentication Services/auth.service';

@Component({
  selector: 'app-add-module',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './add-module.component.html',
  styleUrls: ['./add-module.component.scss']
})
export class AddModuleComponent implements OnInit {
  @Input() module: Module | null = null;
  @Input() currentUserRole: string = 'HOD';
  @Input() lecturers: { id: number; name: string }[] = [];

  moduleForm!: FormGroup;
  submitted = false;
  isSubmitting = false;
  errorMessage = '';
  isEditMode = false;

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private moduleService: ModuleService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.module;
    this.initializeForm();

    if (this.isEditMode && this.module) {
      this.populateForm(this.module);
    }
  }

  initializeForm() {
    // Use synchronous method to get basic user info
    const currentUser = this.authService.getCurrentUserSync();
    
    // Initialize form with empty department, will be populated via Observable
    this.moduleForm = this.formBuilder.group({
      code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/)]],
      name: ['', Validators.required],
      credits: ['', [Validators.required, Validators.min(1)]],
      sessionsPerWeek: ['', [Validators.required, Validators.min(1)]],
      department: [{ value: '', disabled: true }, Validators.required],
      lecturerIds: [[]]
    });

    // Load department info via Observable
    const currentUserObservable = this.authService.getCurrentUser();
    if (currentUserObservable) {
      currentUserObservable.subscribe({
        next: (user) => {
          if (user && user.department) {
            this.moduleForm.patchValue({
              department: user.department
            });
          }
        },
        error: (error) => {
          console.error('Error loading user department:', error);
          this.errorMessage = 'Unable to load department information';
        }
      });
    }
  }

  populateForm(module: Module) {
    this.moduleForm.patchValue({
      code: module.code,
      name: module.name,
      credits: module.credits,
      sessionsPerWeek: module.sessionsPerWeek,
      department: module.department,
      lecturerIds: module.lecturerIds || []
    });
  }

  get f(): { [key: string]: AbstractControl } {
    return this.moduleForm.controls;
  }

  onSubmit() {
    this.submitted = true;

    if (this.moduleForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const formData = this.moduleForm.getRawValue(); // Use getRawValue to include disabled fields
      
      // Validate department is available
      if (!formData.department) {
        this.errorMessage = 'Department information is required. Please ensure you are logged in as an HOD.';
        this.isSubmitting = false;
        return;
      }

      const moduleData: Module = {
        id: this.isEditMode && this.module ? this.module.id : Date.now(), // Use timestamp as ID for now
        code: formData.code,
        name: formData.name,
        credits: parseInt(formData.credits),
        sessionsPerWeek: parseInt(formData.sessionsPerWeek),
        groupCount: 0,
        lecturerCount: formData.lecturerIds.length,
        lecturerIds: formData.lecturerIds,
        department: formData.department,
        createdAt: this.isEditMode && this.module?.createdAt ? this.module.createdAt : new Date(),
        updatedAt: new Date()
      };

      this.moduleService.addModule(moduleData).subscribe({
        next: (result) => {
          if (result.success) {
            this.modalController.dismiss(moduleData);
          } else {
            this.errorMessage = result.message;
            this.isSubmitting = false;
          }
        },
        error: (error) => {
          this.errorMessage = 'An error occurred while saving the module.';
          this.isSubmitting = false;
          console.error('Module submission error:', error);
        }
      });
    } catch (error) {
      this.errorMessage = 'An error occurred while saving the module.';
      this.isSubmitting = false;
      console.error('Form submission error:', error);
    }
  }

  dismissModal() {
    this.modalController.dismiss();
  }
}