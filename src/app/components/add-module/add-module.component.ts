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
  department: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private moduleService: ModuleService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isEditMode = !!this.module;
    this.loadDepartment();
    this.initializeForm();
  }

  loadDepartment() {
    const currentUser$ = this.authService.getCurrentUser();
    if (currentUser$) {
      currentUser$.subscribe(user => {
        console.log('User data from authService:', user);
        this.department = user.department || '';
        // Update form with department after it's loaded
        if (this.moduleForm) {
          this.moduleForm.patchValue({ department: this.department });
        }
        if (this.isEditMode && this.module) {
          this.populateForm(this.module);
        }
      }, error => {
        console.error('Error loading department:', error);
        this.errorMessage = 'Unable to determine department. Please ensure you are logged in as an HOD.';
        this.department = '';
        // Form is already initialized, no need to reinitialize
      });
    } else {
      console.warn('No current user observable available');
      this.errorMessage = 'Unable to determine department. Please ensure you are logged in as an HOD.';
      this.department = '';
    }
  }

  initializeForm() {
    // Use synchronous method to get basic user info
    const currentUser = this.authService.getCurrentUserSync();
    const initialDepartment = currentUser?.department || '';
    // Initialize form with empty department, will be populated via Observable
    this.moduleForm = this.formBuilder.group({
      code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/)]],
      name: ['', Validators.required],
      credits: ['', [Validators.required, Validators.min(1)]],
      sessionsPerWeek: ['', [Validators.required, Validators.min(1)]],
      department: [{ value: initialDepartment, disabled: true }, Validators.required],
      lecturerIds: [[]],
      program: ['', Validators.required]
    });

    // Load department info via Observable
    const currentUserObservable = this.authService.getCurrentUser();
      if (currentUserObservable) {
        currentUserObservable.subscribe({
          next: (user) => {
            if (user && user.department) {
              this.department = user.department;
              this.moduleForm.patchValue({ department: user.department });
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
      lecturerIds: module.lecturerIds || [],
      program: module.program || ''
    });
  }

  get f(): { [key: string]: AbstractControl } {
    return this.moduleForm.controls;
  }

  onSubmit() {
    this.submitted = true;

    if (this.moduleForm.invalid) {
      console.log('Form is invalid:', this.moduleForm.errors, this.moduleForm.value);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const formData = this.moduleForm.getRawValue();
      if (!this.department) {
        this.errorMessage = 'Unable to determine department. Please ensure you are logged in as an HOD.';
        this.isSubmitting = false;
        console.warn('Department not set:', this.department);
        return;
      }

      const sessionsPerWeek = parseInt(formData.sessionsPerWeek);
      if (isNaN(sessionsPerWeek) || sessionsPerWeek < 1) {
        this.errorMessage = 'Sessions per week must be a number greater than or equal to 1.';
        this.isSubmitting = false;
        return;
      }

      const moduleData: Module = {
        id: this.isEditMode && this.module ? this.module.id : Date.now(),
        code: formData.code,
        name: formData.name,
        credits: parseInt(formData.credits),
        sessionsPerWeek: sessionsPerWeek,
        groupCount: 0,
        lecturerCount: formData.lecturerIds.length,
        lecturerIds: formData.lecturerIds,
        department: this.department,
        program: formData.program,
        createdAt: this.isEditMode && this.module?.createdAt ? this.module.createdAt : new Date(),
        updatedAt: new Date()
      };
      console.log('Submitting module data:', moduleData);
      this.moduleService.addModule(moduleData).subscribe({
        next: (result) => {
          console.log('Module service response:', result);
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

  ngAfterViewInit() {
    console.log('Form after view init:', this.moduleForm);
    if (!this.moduleForm) {
      console.error('moduleForm is not initialized');
    }
  }
}