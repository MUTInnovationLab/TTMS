import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ModuleService } from '../../services/Entity Management Services/module.service';
import { AuthService } from '../../services/Authentication Services/auth.service';

export interface Module {
  id: number;
  code: string;
  name: string;
  credits: number;
  sessionsPerWeek: number;
  groupCount: number;
  lecturerCount: number;
  lecturerIds: number[];
  department: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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
    const currentUser = this.authService.getCurrentUser();
    const department = currentUser?.department || '';

    this.moduleForm = this.formBuilder.group({
      code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/)]],
      name: ['', Validators.required],
      credits: ['', [Validators.required, Validators.min(1)]],
      sessionsPerWeek: ['', [Validators.required, Validators.min(1)]],
      department: [{ value: department, disabled: true }, Validators.required],
      lecturerIds: [[]]
    });
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
      const currentUser = this.authService.getCurrentUser();

      if (!currentUser || !currentUser.department) {
        this.errorMessage = 'Unable to determine department. Please ensure you are logged in as an HOD.';
        this.isSubmitting = false;
        return;
      }

      const moduleData: Module = {
        id: this.isEditMode && this.module ? this.module.id : 0,
        code: formData.code,
        name: formData.name,
        credits: parseInt(formData.credits),
        sessionsPerWeek: parseInt(formData.sessionsPerWeek),
        groupCount: 0, // Will be updated later based on assignments
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