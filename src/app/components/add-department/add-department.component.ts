import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Department } from '../../interfaces/department.interface';

import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-department',
  templateUrl: './add-department.component.html',
  styleUrls: ['./add-department.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule]
})
export class AddDepartmentComponent implements OnInit {
  @Input() department: Department | null = null;
  @Input() currentUserRole: string = '';
  @Output() departmentCreated = new EventEmitter<Department>();

  departmentForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private modalController: ModalController
  ) {
    this.departmentForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      location: ['', Validators.required],
      hodName: ['']
    });
  }

  ngOnInit() {
    if (this.department) {
      this.departmentForm.patchValue({
        name: this.department.name,
        code: this.department.code,
        location: this.department.location,
        hodName: this.department.hodName || ''
      });
    }
  }

  async submitForm() {
    if (this.departmentForm.valid) {
      const formValue = this.departmentForm.value;
      const newDepartment: Department = {
        ...this.department,
        name: formValue.name,
        code: formValue.code,
        location: formValue.location,
        hodName: formValue.hodName,
        description: this.department?.description || '',
        hodId: this.department?.hodId || '',
        hodEmail: this.department?.hodEmail || '',
        phone: this.department?.phone || '',
        email: this.department?.email || '',
        budget: this.department?.budget || 0,
        status: this.department?.status || 'active',
        createdAt: this.department?.createdAt || new Date(),
        updatedAt: new Date(),
        establishedYear: this.department?.establishedYear || new Date().getFullYear()
      };

      this.departmentCreated.emit(newDepartment);
      await this.modalController.dismiss({ department: newDepartment });
    } else {
      this.departmentForm.markAllAsTouched();
    }
  }

  async cancel() {
    await this.modalController.dismiss();
  }
}
