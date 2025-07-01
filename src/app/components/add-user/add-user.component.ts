
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

export interface User {
  id: string;
  title: string;
  name: string;
  staffId?: number;
  sex?: string;
  department: string;
  roomName?: string;
  role: string;
  schedulable?: boolean;
  contact: {
    email: string;
    mobile?: string;
    officeTel?: string;
    homeTel?: string;
    fax?: string;
    website?: string;
  };
  address?: {
    line1?: string;
    line2?: string;
    line3?: string;
    line4?: string;
    postcode?: string;
  };
  accessibility?: {
    deafLoop: boolean;
    wheelchairAccess: boolean;
  };
  weeklyTarget?: number;
  totalTarget?: number;
  allowanceWeek?: number;
  allowanceTotal?: number;
  profile?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './add-user.component.html',
  styleUrls: ['./add-user.component.scss']
})
export class AddUserComponent implements OnInit {
  @Input() user: User | null = null;
  @Input() currentUserRole: string = 'Admin'; // Role of user creating the new user
  
  userForm!: FormGroup;
  submitted = false;
  isSubmitting = false;
  errorMessage = '';
  isEditMode = false;
  
  // Available roles based on the current user's role
  availableRoles: string[] = [];
  
  // Full list of departments in the system
  departments = [
    'MECHANICAL ENGINEERING', 
    'CONSTRUCTION MANAGEMENT & QS', 
    'SURVEY/CIVIL ENGINEERING', 
    'CHEMICAL ENGINEERING', 
    'ELECTRICAL ENGINEERING', 
    'ECONOMICS', 
    'PUBLIC ADMINISTRATION', 
    'COMMUNICATION', 
    'OFFICE TECHNOLOGY', 
    'LAW', 
    'ACCOUNTING', 
    'MARKETING', 
    'HUMAN RESOURCE MANAGEMENT', 
    'OFFICE OF DEAN OF MAN SCIENCES', 
    'COMMUNITY EXTENTION', 
    'AGRICULTURE', 
    'NATURE CONSERVATION', 
    'CHEMISTRY', 
    'INFO & COMMS TECHNOLOGY', 
    'MATHEMATICS', 
    'ENVIRONMENTAL HEALTH', 
    'OFFICE OF DEAN OF NAT SCIENCES', 
    'INFORMATION TECH & NETWORKS', 
    'INST OF RURAL DEV & COMM ENG'
  ];
  
  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController
  ) {}
  
  ngOnInit() {
    this.isEditMode = !!this.user;
    this.setAvailableRoles();
    this.initializeForm();
    
    if (this.isEditMode && this.user) {
      this.populateForm(this.user);
    }
  }
  
  setAvailableRoles() {
    // Set available roles based on current user role
    switch (this.currentUserRole) {
      case 'Admin':
        this.availableRoles = ['HOD'];
        break;
      case 'HOD':
        this.availableRoles = ['Lecturer'];
        break;
      case 'Lecturer':
        this.availableRoles = ['Student'];
        break;
      default:
        this.availableRoles = [];
    }
    
    // If editing, always include the current user's role
    if (this.isEditMode && this.user && !this.availableRoles.includes(this.user.role)) {
      this.availableRoles.push(this.user.role);
    }
  }
  
  initializeForm() {
    this.userForm = this.formBuilder.group({
      role: ['', [Validators.required]],
      title: ['', [Validators.required]],
      name: ['', [Validators.required]],
      id: ['', [Validators.required]],
      sex: [''],
      department: ['', [Validators.required]],
      roomName: [''],
      schedulable: [false],
      email: ['', [Validators.required, Validators.email]],
      mobile: [''],
      officeTel: [''],
      homeTel: [''],
      website: [''],
      addressLine1: [''],
      addressLine2: [''],
      postcode: [''],
      deafLoop: [false],
      wheelchairAccess: [false],
      weeklyTarget: [0],
      totalTarget: [0]
    });
    
    // Set default role if available
    if (this.availableRoles.length > 0) {
      this.userForm.get('role')?.setValue(this.availableRoles[0]);
      this.onRoleChange();
    }
    
    // Subscribe to schedulable changes to update validation
    this.userForm.get('schedulable')?.valueChanges.subscribe(value => {
      const weeklyTarget = this.userForm.get('weeklyTarget');
      const totalTarget = this.userForm.get('totalTarget');
      
      if (value && weeklyTarget && totalTarget) {
        weeklyTarget.setValidators([Validators.required, Validators.min(0)]);
        totalTarget.setValidators([Validators.required, Validators.min(0)]);
      } else if (weeklyTarget && totalTarget) {
        weeklyTarget.clearValidators();
        totalTarget.clearValidators();
      }
      
      weeklyTarget?.updateValueAndValidity();
      totalTarget?.updateValueAndValidity();
    });
    
    // Subscribe to role changes
    this.userForm.get('role')?.valueChanges.subscribe(role => {
      this.onRoleChange();
    });
  }
  
  onRoleChange() {
    const role = this.userForm.get('role')?.value;
    
    // Adjust form based on role
    if (role === 'Student') {
      // Students don't need room name or scheduling
      this.userForm.get('roomName')?.clearValidators();
      this.userForm.get('schedulable')?.setValue(false);
    } else if (role === 'Lecturer') {
      // Lecturers can be schedulable
      this.userForm.get('schedulable')?.enable();
    } else if (role === 'HOD') {
      // HODs are always schedulable
      this.userForm.get('schedulable')?.setValue(true);
    }
    
    // Update form validations
    this.userForm.get('roomName')?.updateValueAndValidity();
    this.userForm.get('schedulable')?.updateValueAndValidity();
  }
  
  populateForm(user: User) {
    this.userForm.patchValue({
      role: user.role,
      title: user.title,
      name: user.name,
      id: user.id,
      sex: user.sex,
      department: user.department,
      roomName: user.roomName,
      schedulable: user.schedulable || false,
      email: user.contact?.email,
      mobile: user.contact?.mobile,
      officeTel: user.contact?.officeTel,
      homeTel: user.contact?.homeTel,
      website: user.contact?.website,
      addressLine1: user.address?.line1,
      addressLine2: user.address?.line2,
      postcode: user.address?.postcode,
      deafLoop: user.accessibility?.deafLoop,
      wheelchairAccess: user.accessibility?.wheelchairAccess,
      weeklyTarget: user.weeklyTarget || 0,
      totalTarget: user.totalTarget || 0
    });
    
    // Trigger role change to adjust form based on loaded role
    this.onRoleChange();
  }
  
  get f(): { [key: string]: AbstractControl } { 
    return this.userForm.controls; 
  }
  
  isStaffRole(): boolean {
    const role = this.userForm.get('role')?.value;
    return role === 'HOD' || role === 'Lecturer';
  }
  
  onSubmit() {
    this.submitted = true;
    
    if (this.userForm.invalid) {
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    try {
      const formData = this.userForm.value;
      
      // Format the data for submission
      const userData: User = {
        id: formData.id,
        title: formData.title,
        name: formData.name,
        sex: formData.sex,
        department: formData.department,
        roomName: formData.roomName,
        role: formData.role,
        schedulable: formData.role === 'HOD' ? true : (formData.role === 'Lecturer' ? formData.schedulable : false),
        contact: {
          email: formData.email,
          mobile: formData.mobile,
          officeTel: formData.officeTel,
          homeTel: formData.homeTel,
          website: formData.website
        },
        address: this.isStaffRole() ? {
          line1: formData.addressLine1,
          line2: formData.addressLine2,
          postcode: formData.postcode
        } : undefined,
        accessibility: {
          deafLoop: formData.deafLoop,
          wheelchairAccess: formData.wheelchairAccess
        },
        weeklyTarget: (formData.role === 'Lecturer' && formData.schedulable) ? formData.weeklyTarget : 0,
        totalTarget: (formData.role === 'Lecturer' && formData.schedulable) ? formData.totalTarget : 0,
        createdAt: this.isEditMode && this.user?.createdAt ? this.user.createdAt : new Date(),
        updatedAt: new Date()
      };
      
      // Close modal and return user data
      this.modalController.dismiss(userData);
    } catch (error) {
      console.error('Form submission error:', error);
      this.errorMessage = 'An error occurred while saving the user.';
      this.isSubmitting = false;
    }
  }
  
  dismissModal() {
    this.modalController.dismiss();
  }
}
