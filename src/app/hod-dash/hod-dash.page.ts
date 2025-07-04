import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { ModalController } from '@ionic/angular';
import { Venue } from '../components/venue-avail/venue-avail.component';
import { Conflict, ConflictResolution, ConflictType } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
// Remove GroupService import temporarily
// import { GroupService } from '../services/group.service';
import { Group } from '../models/group.model';
import { User } from '../components/add-user/add-user.component';
import { TimetableService, TimetableSession as TimetableServiceSession } from '../services/Timetable Core Services/timetable.service';
import { SessionService, SessionRequest } from '../services/Timetable Core Services/session.service';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';
import { AddUserComponent } from '../components/add-user/add-user.component';
import { BulkUploadLecturersComponent } from '../components/bulk-upload-lecturers/bulk-upload-lecturers.component';
import { LecturerService } from '../services/Entity Management Services/lecturer.service';
import { BulkUploadModulesComponent } from '../components/bulk-upload-modules/bulk-upload-modules.component';
import { ModuleService, Module } from '../services/Entity Management Services/module.service';
import { AddModuleComponent } from '../components/add-module/add-module.component';

interface SessionForGrid {
  id: number;
  moduleId: number;
  moduleName: string;
  day: string;
  timeSlot: string;
  venueId: string; // Changed from number to string
  venue: string;
  lecturerId: number;
  lecturer: string;
  groupId: number;
  group: string;
  hasConflict: boolean;
}

interface SessionForm {
  moduleId: number;
  moduleName: string;
  venueId: string; // Changed from number to string
  venue: string;
  lecturerId: number;
  lecturer: string;
  groupId: number;
  group: string;
  day: string;
  timeSlot: string;
  category: string;
  notes: string;
  departmentId: number;
}

@Component({
  selector: 'app-hod-dash',
  templateUrl: './hod-dash.page.html',
  styleUrls: ['./hod-dash.page.scss'],
  standalone: false,
})
export class HodDashPage implements OnInit, OnDestroy {
  // Header properties
  notificationCount: number = 3;
  showProfileMenu: boolean = false;

  // Sidebar state
  sidebarVisible = false;
  private sidebarSubscription?: Subscription;

  // Dashboard navigation
  activeSection: string = 'dashboard';

  // Department Info
  departmentInfo = {
    id: 1,
    name: 'Computer Science Department',
    hodName: 'Dr. John Smith',
    email: 'cs@university.edu',
    phone: '+1 234 567 890',
    location: 'Building A, Floor 3'
  };

  // Department Statistics
  departmentStats = {
    lecturers: 12,
    groups: 8,
    modules: 24,
    sessions: 48
  };

  // Submission Status
  submissionStatus = {
    status: 'in-progress', // Options: draft, in-progress, submitted, rejected, incomplete
    label: 'In Progress',
    message: 'Complete your timetable by May 30, 2023 to meet the submission deadline.',
    canEdit: true,
    buttonText: 'Edit Timetable'
  };

  // Conflicts
  conflicts = [
    {
      id: 1,
      type: 'Lecturer',
      description: 'Dr. Sarah Johnson is scheduled for two classes at the same time on Monday at 10:00 AM.',
      moduleIds: [3, 7],
      timeSlot: '10:00 AM',
      day: 'Monday'
    },
    {
      id: 2,
      type: 'Venue',
      description: 'Room L201 is double-booked on Wednesday at 2:00 PM.',
      moduleIds: [5, 12],
      timeSlot: '2:00 PM',
      day: 'Wednesday'
    }
  ];

  // Recent Sessions
  recentSessions = [
    {
      id: 1,
      moduleName: 'Database Systems',
      moduleId: 3,
      day: 'Monday',
      timeSlot: '09:00 - 11:00',
      venue: 'Lab L101',
      lecturer: 'Dr. Robert Brown',
      group: 'CS-Year2-A',
      scheduledAt: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      id: 2,
      moduleName: 'Algorithms and Data Structures',
      moduleId: 7,
      day: 'Tuesday',
      timeSlot: '13:00 - 15:00',
      venue: 'Room A201',
      lecturer: 'Dr. Sarah Johnson',
      group: 'CS-Year1-B',
      scheduledAt: new Date(Date.now() - 7200000) // 2 hours ago
    },
    {
      id: 3,
      moduleName: 'Software Engineering',
      moduleId: 12,
      day: 'Thursday',
      timeSlot: '11:00 - 13:00',
      venue: 'Room A102',
      lecturer: 'Prof. Michael Davis',
      group: 'CS-Year3-A',
      scheduledAt: new Date(Date.now() - 86400000) // 1 day ago
    }
  ];

  // Timetable Data
  weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  timeSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'];

  timetableFilters = {
    lecturer: null,
    group: null,
    module: null
  };

  timetableSessions: SessionForGrid[] = [
    {
      id: 1,
      moduleId: 3,
      moduleName: 'Database Systems',
      day: 'Monday',
      timeSlot: '09:00 - 10:00',
      venueId: '5',
      venue: 'Lab L101',
      lecturerId: 2,
      lecturer: 'Dr. Robert Brown',
      groupId: 3,
      group: 'CS-Year2-A',
      hasConflict: false
    },
    {
      id: 2,
      moduleId: 7,
      moduleName: 'Algorithms',
      day: 'Monday',
      timeSlot: '10:00 - 11:00',
      venueId: '2',
      venue: 'Room A201',
      lecturerId: 3,
      lecturer: 'Dr. Sarah Johnson',
      groupId: 4,
      group: 'CS-Year1-B',
      hasConflict: true
    },
    {
      id: 3,
      moduleId: 5,
      moduleName: 'Web Development',
      day: 'Wednesday',
      timeSlot: '14:00 - 15:00',
      venueId: '7',
      venue: 'Lab L201',
      lecturerId: 4,
      lecturer: 'Dr. Emily Taylor',
      groupId: 3,
      group: 'CS-Year2-A',
      hasConflict: true
    }
  ];

  canSubmitTimetable = true;

  // Lecturers Data
  lecturerSearch = '';
  lecturerView = 'list';

  lecturers = [
    {
      id: 1,
      name: 'Dr. John Smith',
      email: 'john.smith@university.edu',
      avatar: 'assets/avatar1.png',
      moduleCount: 4,
      weeklyHours: 18,
      workloadPercentage: 0.75,
      specialization: 'Artificial Intelligence'
    },
    {
      id: 2,
      name: 'Dr. Robert Brown',
      email: 'robert.brown@university.edu',
      avatar: 'assets/avatar2.png',
      moduleCount: 3,
      weeklyHours: 12,
      workloadPercentage: 0.5,
      specialization: 'Database Systems'
    },
    {
      id: 3,
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@university.edu',
      avatar: 'assets/avatar3.png',
      moduleCount: 5,
      weeklyHours: 20,
      workloadPercentage: 0.83,
      specialization: 'Algorithms and Data Structures'
    },
    {
      id: 4,
      name: 'Dr. Emily Taylor',
      email: 'emily.taylor@university.edu',
      avatar: 'assets/avatar4.png',
      moduleCount: 3,
      weeklyHours: 14,
      workloadPercentage: 0.58,
      specialization: 'Web Technologies'
    }
  ];

  get filteredLecturers() {
    if (!this.lecturerSearch) return this.lecturers;
    return this.lecturers.filter(lecturer =>
      lecturer.name.toLowerCase().includes(this.lecturerSearch.toLowerCase()) ||
      lecturer.email.toLowerCase().includes(this.lecturerSearch.toLowerCase()) ||
      lecturer.specialization.toLowerCase().includes(this.lecturerSearch.toLowerCase())
    );
  }

  // Groups Data
  groupSearch = '';
  groupView = 'list';
  selectedGroupForTimetable = null;

  // Initialize with mock data instead of service
  groups: Group[] = [
    {
      id: 1,
      name: 'CS-Year1-A',
      program: 'Computer Science',
      year: 1,
      semester: 1,
      studentCount: 25,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      name: 'CS-Year1-B',
      program: 'Computer Science',
      year: 1,
      semester: 1,
      studentCount: 28,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      name: 'CS-Year2-A',
      program: 'Computer Science',
      year: 2,
      semester: 1,
      studentCount: 22,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Modules Data
  moduleSearch = '';

  modules = [
    {
      id: 1,
      code: 'CS101',
      name: 'Introduction to Programming',
      credits: 10,
      sessionsPerWeek: 3,
      groupCount: 2,
      lecturerCount: 2,
      lecturerIds: [1, 3]
    },
    {
      id: 3,
      code: 'CS205',
      name: 'Database Systems',
      credits: 15,
      sessionsPerWeek: 4,
      groupCount: 1,
      lecturerCount: 1,
      lecturerIds: [2]
    },
    {
      id: 5,
      code: 'CS210',
      name: 'Web Development',
      credits: 15,
      sessionsPerWeek: 3,
      groupCount: 2,
      lecturerCount: 1,
      lecturerIds: [4]
    },
    {
      id: 7,
      code: 'CS202',
      name: 'Algorithms and Data Structures',
      credits: 15,
      sessionsPerWeek: 4,
      groupCount: 2,
      lecturerCount: 1,
      lecturerIds: [3]
    },
    {
      id: 12,
      code: 'CS305',
      name: 'Software Engineering',
      credits: 20,
      sessionsPerWeek: 5,
      groupCount: 1,
      lecturerCount: 1,
      lecturerIds: [1]
    }
  ];

  // Submission History
  submissionHistory = [
    {
      id: 1,
      academicPeriod: 'Semester 1, 2022-2023',
      submittedAt: new Date('2022-08-25T14:30:00'),
      status: 'Approved',
      conflictCount: 0,
      hasAdminFeedback: false
    },
    {
      id: 2,
      academicPeriod: 'Semester 2, 2022-2023',
      submittedAt: new Date('2023-01-15T11:45:00'),
      status: 'Rejected',
      conflictCount: 3,
      hasAdminFeedback: true,
      adminFeedback: 'Multiple conflicts detected. Please resolve and resubmit.'
    },
    {
      id: 3,
      academicPeriod: 'Semester 1, 2023-2024',
      submittedAt: new Date('2023-04-30T09:20:00'),
      status: 'Pending',
      conflictCount: 1,
      hasAdminFeedback: false
    }
  ];

  // For timetable grid integration
  formattedTimetableSessions: TimetableSession[] = [];

  // Selected submission for viewing details
  selectedSubmission: any = null;
  selectedSubmissionTimetable: TimetableSession[] = [];

  // Venue availability properties
  showVenueModal = false;
  availableVenues: Venue[] = [];
  venuesLoading = false;

  // Current session being edited/created
  currentSession: any = null;

  // Conflict resolution properties
  showConflictResolver: boolean = false;
  departmentConflicts: Conflict[] = [];

  // Add these properties
  private departmentId = 1; // Example department ID
  sessionToAdd: SessionForm | null = null;

  constructor(
    private alertController: AlertController,
    private router: Router,
    private modalController: ModalController,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private timetableService: TimetableService,
    private sessionService: SessionService,
    private venueService: VenueService,
    private lecturerService: LecturerService,
    private toastController: ToastController,
    private moduleService: ModuleService
  ) {
    console.log('HodDashPage constructor');
  }

  ngOnInit() {
    console.log('HodDashPage ngOnInit');

    // Load venues from database FIRST and WAIT for completion
    this.loadVenuesAndInitialize();

    // Set initial sidebar state
    this.sidebarVisible = this.sidebarService.isSidebarVisible;
    console.log('Initial sidebar state:', this.sidebarVisible);

    // Subscribe to sidebar state
    this.sidebarSubscription = this.sidebarService.sidebarVisible$.subscribe(
      state => {
        console.log('HOD sidebar state changed:', state);
        this.sidebarVisible = state;
        this.cdr.detectChanges();
      }
    );
  }

  // New method to load venues first, then initialize other components
  loadVenuesAndInitialize() {
    console.log('HOD: Loading venues and initializing...');
    this.venuesLoading = true;

    // Load venues first
    this.venueService.getAllVenues().subscribe({
      next: (venues) => {
        console.log('HOD: Initial venue load completed:', venues.length);

        if (venues.length > 0) {
          this.availableVenues = venues.map(venue => ({
            id: venue.id,
            name: venue.name,
            type: venue.type,
            capacity: venue.capacity,
            equipment: venue.equipment,
            department: venue.department,
            site: venue.site,
            schedulable: venue.schedulable,
            autoSchedulable: venue.autoSchedulable,
            accessibility: venue.accessibility,
            building: venue.site || 'Unknown Building',
            room: this.extractRoomFromVenueName(venue.name, venue.id),
            image: 'assets/default-venue.jpg',
            description: `${venue.type} located at ${venue.site} with capacity of ${venue.capacity}`,
            floor: this.extractFloorFromVenueId(venue.id),
            availability: true
          }));

          console.log('HOD: Venues transformed and ready:', this.availableVenues.length);
        }

        this.venuesLoading = false;

        // Now initialize timetable after venues are loaded
        this.initializeTimetable();
      },
      error: (error) => {
        console.error('HOD: Error in initial venue load:', error);
        this.venuesLoading = false;
        this.createMockVenues(); // Fallback to mock data
        this.initializeTimetable();
      }
    });
  }

  // Separate method to initialize timetable
  private initializeTimetable() {
    console.log('HOD: Initializing timetable...');

    // Initialize the current timetable
    this.timetableService.getCurrentTimetable(this.departmentId).subscribe(timetable => {
      if (timetable) {
        console.log('Current timetable loaded:', timetable);
        this.formatTimetableSessions();
      }
    });

    // Subscribe to session changes
    this.timetableService.sessions$.subscribe(sessions => {
      this.timetableSessions = sessions.map(session => ({
        id: session.id,
        moduleId: session.moduleId,
        moduleName: session.moduleName,
        day: session.day,
        timeSlot: session.timeSlot,
        venueId: session.venueId,
        venue: session.venue,
        lecturerId: session.lecturerId,
        lecturer: session.lecturer,
        groupId: session.groupId,
        group: session.group,
        hasConflict: session.hasConflict || false
      }));
      this.formatTimetableSessions();
      this.detectTimetableConflicts();
    });
  }

  // Remove the original loadVenues method and replace with this simpler version
  // loadVenues() {
  //   this.loadVenuesAndInitialize();
  // }

  ngOnDestroy() {
    // Clean up subscription
    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
  }

  // Header actions
  toggleProfileMenu() {
    this.showProfileMenu = !this.showProfileMenu;
  }

  navigateToSettings() {
    // Navigate to settings
    this.showProfileMenu = false;
  }



  showNotifications() {
    console.log('Show notifications');
  }

  // Navigation
  changeSection(section: string) {
    this.activeSection = section;
  }

  // Toggle sidebar
  toggleSidebar() {
    console.log('HOD toggleSidebar called, current state:', this.sidebarVisible);
    this.sidebarService.toggleSidebar();
  }

  // Conflicts
  resolveConflict(conflict: any) {
    console.log('Resolving conflict:', conflict);
    this.activeSection = 'timetable';
    // Logic to navigate to the specific time slot
  }

  // Timetable methods
  hasSession(day: string, timeSlot: string): boolean {
    return this.timetableSessions.some(session =>
      session.day === day && session.timeSlot === timeSlot &&
      this.matchesFilters(session)
    );
  }

  getSession(day: string, timeSlot: string): any {
    return this.timetableSessions.find(session =>
      session.day === day && session.timeSlot === timeSlot &&
      this.matchesFilters(session)
    );
  }

  matchesFilters(session: any): boolean {
    const lecturerMatch = !this.timetableFilters.lecturer || session.lecturerId === this.timetableFilters.lecturer;
    const groupMatch = !this.timetableFilters.group || session.groupId === this.timetableFilters.group;
    const moduleMatch = !this.timetableFilters.module || session.moduleId === this.timetableFilters.module;

    return lecturerMatch && groupMatch && moduleMatch;
  }

  handleTimeSlotClick(day: string, timeSlot: string) {
    if (this.hasSession(day, timeSlot)) {
      const session = this.getSession(day, timeSlot);
      this.editSession(session);
    } else {
      this.addSessionAt(day, timeSlot);
    }
  }

  // Update the add session method to use the service
  addSession() {
    // Reset the session to add
    this.sessionToAdd = {
      moduleId: 0,
      moduleName: '',
      lecturerId: 0,
      lecturer: '',
      venueId: '',
      venue: '',
      groupId: 0,
      group: '',
      day: 'Monday',
      timeSlot: '08:00 - 09:00',
      departmentId: this.departmentId,
      category: 'Lecture',
      notes: ''
    };

    // Open venue selection modal
    this.openVenueAvailability();
  }

  addSessionAt(day: string, timeSlot: string) {
    console.log(`Adding session at ${day}, ${timeSlot}`);
    // Show modal to add session at specific time
  }

  editSession(session: any) {
    console.log('Editing session:', session);
    this.openVenueAvailability(session);
  }

  // Update the handle venue booking method
  handleVenueBooking(event: { venue: Venue, date: Date, startSlot?: number, endSlot?: number }) {
    console.log('Venue booking:', event);

    if (!this.sessionToAdd) {
      this.sessionToAdd = {
        moduleId: 0,
        moduleName: '',
        lecturerId: 0,
        lecturer: '',
        venueId: '',
        venue: '',
        groupId: 0,
        group: '',
        day: 'Monday',
        timeSlot: '08:00 - 09:00',
        departmentId: this.departmentId,
        category: 'Lecture',
        notes: ''
      };
    }

    // Update the venue information
    this.sessionToAdd.venueId = event.venue.id;
    this.sessionToAdd.venue = event.venue.name;

    // If slots are provided, update the session time
    if (event.startSlot !== undefined && event.endSlot !== undefined) {
      // Convert slot numbers to time string
      this.sessionToAdd.timeSlot = this.sessionService.formatTimeSlot(event.startSlot, event.endSlot);

      // Update day based on the selected date
      const dayOfWeek = event.date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        this.sessionToAdd.day = this.weekDays[dayOfWeek - 1]; // Adjust for zero-based array
      }
    }

    this.closeVenueModal();
    this.openSessionDetailsModal();
  }

  // Add a new method to open session details modal
  async openSessionDetailsModal() {
    // In a real app, you would use a modal here
    // For now, let's just prompt for the details using alerts

    // 1. First, select module
    const moduleSelect = await this.alertController.create({
      header: 'Select Module',
      inputs: this.modules.map(module => ({
        name: `module-${module.id}`,
        type: 'radio',
        label: `${module.name} (${module.code})`,
        value: module.id,
        checked: false
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Next',
          handler: (moduleId) => {
            if (this.sessionToAdd && moduleId) {
              const selectedModule = this.modules.find(m => m.id === moduleId);
              if (selectedModule) {
                this.sessionToAdd.moduleId = selectedModule.id;
                this.sessionToAdd.moduleName = selectedModule.name;
                this.selectLecturerForSession();
              }
            }
          }
        }
      ]
    });

    await moduleSelect.present();
  }

  // Select lecturer for the session
  async selectLecturerForSession() {
    const lecturerSelect = await this.alertController.create({
      header: 'Select Lecturer',
      inputs: this.lecturers.map(lecturer => ({
        name: `lecturer-${lecturer.id}`,
        type: 'radio',
        label: lecturer.name,
        value: lecturer.id,
        checked: false
      })),
      buttons: [
        {
          text: 'Back',
          handler: () => {
            this.openSessionDetailsModal();
          }
        },
        {
          text: 'Next',
          handler: (lecturerId) => {
            if (this.sessionToAdd && lecturerId) {
              const selectedLecturer = this.lecturers.find(l => l.id === lecturerId);
              if (selectedLecturer) {
                this.sessionToAdd.lecturerId = selectedLecturer.id;
                this.sessionToAdd.lecturer = selectedLecturer.name;
                this.selectGroupForSession();
              }
            }
          }
        }
      ]
    });

    await lecturerSelect.present();
  }

  // Select group for the session
  async selectGroupForSession() {
    const groupSelect = await this.alertController.create({
      header: 'Select Student Group',
      inputs: this.groups.map(group => ({
        name: `group-${group.id}`,
        type: 'radio',
        label: group.name,
        value: group.id,
        checked: false
      })),
      buttons: [
        {
          text: 'Back',
          handler: () => {
            this.selectLecturerForSession();
          }
        },
        {
          text: 'Next',
          handler: (groupId) => {
            if (this.sessionToAdd && groupId) {
              const selectedGroup = this.groups.find(g => g.id === groupId);
              if (selectedGroup) {
                this.sessionToAdd.groupId = selectedGroup.id;
                this.sessionToAdd.group = selectedGroup.name;
                this.selectSessionType();
              }
            }
          }
        }
      ]
    });

    await groupSelect.present();
  }

  // Select session type
  async selectSessionType() {
    const typeSelect = await this.alertController.create({
      header: 'Select Session Type',
      inputs: [
        {
          name: 'type-lecture',
          type: 'radio',
          label: 'Lecture',
          value: 'Lecture',
          checked: true
        },
        {
          name: 'type-lab',
          type: 'radio',
          label: 'Lab',
          value: 'Lab',
          checked: false
        },
        {
          name: 'type-tutorial',
          type: 'radio',
          label: 'Tutorial',
          value: 'Tutorial',
          checked: false
        },
        {
          name: 'type-seminar',
          type: 'radio',
          label: 'Seminar',
          value: 'Seminar',
          checked: false
        }
      ],
      buttons: [
        {
          text: 'Back',
          handler: () => {
            this.selectGroupForSession();
          }
        },
        {
          text: 'Create Session',
          handler: (sessionType) => {
            if (this.sessionToAdd) {
              this.sessionToAdd.category = sessionType;
              this.createSession();
            }
          }
        }
      ]
    });

    await typeSelect.present();
  }

  // Create the session
  createSession() {
    if (!this.sessionToAdd) return;

    this.sessionService.createSession(this.sessionToAdd).subscribe(
      (newSession) => {
        console.log('Session created:', newSession);

        // Show success message
        this.alertController.create({
          header: 'Success',
          message: 'Session has been added to the timetable',
          buttons: ['OK']
        }).then(alert => alert.present());

        // Reset session to add
        this.sessionToAdd = null;
      },
      (error) => {
        console.error('Error creating session:', error);

        // Show error message
        this.alertController.create({
          header: 'Error',
          message: 'Failed to create session. Please try again.',
          buttons: ['OK']
        }).then(alert => alert.present());
      }
    );
  }

  // Override this method to use the timetable service
  submitTimetable() {
    // Check for conflicts before submission
    this.detectTimetableConflicts();

    if (this.departmentConflicts.length > 0) {
      this.showConflictResolver = true;
      console.log('Cannot submit timetable with conflicts. Please resolve them first.');
      return;
    }

    console.log('Submitting timetable');

    // Use the timetable service to submit
    this.timetableService.submitTimetable().subscribe(
      (submittedTimetable) => {
        console.log('Timetable submitted:', submittedTimetable);

        // Update submission status
        this.submissionStatus = {
          status: 'submitted',
          label: 'Submitted',
          message: 'Your timetable has been submitted for approval.',
          canEdit: false,
          buttonText: 'View Timetable'
        };

        // Add to submission history
        const newSubmission = {
          id: Math.max(0, ...this.submissionHistory.map(s => s.id)) + 1,
          academicPeriod: submittedTimetable.academicYear + ', Semester ' + submittedTimetable.semester,
          submittedAt: new Date(),
          status: 'Pending',
          conflictCount: 0,
          hasAdminFeedback: false
        };

        this.submissionHistory.unshift(newSubmission);

        // Show success message
        this.alertController.create({
          header: 'Success',
          message: 'Timetable has been submitted for approval',
          buttons: ['OK']
        }).then(alert => alert.present());
      },
      (error) => {
        console.error('Error submitting timetable:', error);

        // Show error message
        this.alertController.create({
          header: 'Error',
          message: 'Failed to submit timetable. Please try again.',
          buttons: ['OK']
        }).then(alert => alert.present());
      }
    );
  }

  // Format the existing timetable sessions for the timetable grid component
  formatTimetableSessions() {
    this.formattedTimetableSessions = this.timetableSessions.map(session => {
      // Map day string to number (0-6)
      const dayMap: { [key: string]: number } = {
        'Monday': 0,
        'Tuesday': 1,
        'Wednesday': 2,
        'Thursday': 3,
        'Friday': 4,
        'Saturday': 5,
        'Sunday': 6
      };

      // Map time slot to start and end slot numbers
      const timeSlotParts = session.timeSlot.split(' - ');
      const startHour = parseInt(timeSlotParts[0].split(':')[0]);
      const endHour = parseInt(timeSlotParts[1].split(':')[0]);

      // Get color based on module
      const moduleColor = this.getModuleColor(session.moduleId);

      return {
        id: session.id,
        title: session.moduleName,
        module: session.moduleName,
        moduleCode: this.getModuleCode(session.moduleId),
        lecturer: session.lecturer,
        venue: session.venue,
        group: session.group,
        day: dayMap[session.day],
        startSlot: startHour - 8, // Assuming 8am is the first slot (slot 0)
        endSlot: endHour - 8,     // Assuming 9am is the second slot (slot 1), etc.
        category: this.getModuleCategory(session.moduleId),
        color: moduleColor,
        departmentId: this.departmentInfo.id,
        hasConflict: session.hasConflict
      } as TimetableSession;
    });
  }

  // Get module code by id
  getModuleCode(moduleId: number): string {
    const module = this.modules.find(m => m.id === moduleId);
    return module ? module.code : 'Unknown';
  }

  // Get module category (for coloring)
  getModuleCategory(moduleId: number): string {
    // Simple mapping based on module ID for this example
    const categories = ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Exam'];
    return categories[moduleId % categories.length];
  }

  // Get color for module
  getModuleColor(moduleId: number): string {
    const category = this.getModuleCategory(moduleId);
    const colorMap: { [key: string]: string } = {
      'Lecture': '#4c8dff',
      'Lab': '#ffc409',
      'Tutorial': '#2dd36f',
      'Seminar': '#92949c',
      'Exam': '#eb445a'
    };
    return colorMap[category] || '#92949c';
  }

  // Handle session click from timetable grid
  handleSessionClick(session: TimetableSession) {
    console.log('Session clicked:', session);
    // Find the original session data
    const originalSession = this.timetableSessions.find(s => s.id === session.id);
    if (originalSession) {
      this.editSession(originalSession);
    }
  }

  // Handle session drop from timetable grid
  handleSessionDrop(event: { session: TimetableSession, day: number, startSlot: number }) {
    console.log('Session dropped:', event);

    // Map day number back to string
    const dayMap = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const newDay = dayMap[event.day];

    // Map start slot to time slot string
    const newStartHour = event.startSlot + 8;
    const newEndHour = newStartHour + 1; // Assuming 1-hour sessions
    const newTimeSlot = `${newStartHour}:00 - ${newEndHour}:00`;

    // Find and update the session
    const sessionIndex = this.timetableSessions.findIndex(s => s.id === event.session.id);
    if (sessionIndex !== -1) {
      this.timetableSessions[sessionIndex] = {
        ...this.timetableSessions[sessionIndex],
        day: newDay,
        timeSlot: newTimeSlot
      };

      // Re-format sessions for the grid
      this.formatTimetableSessions();
    }
  }

  editLecturer(lecturer: any) {
    console.log('Editing lecturer:', lecturer);
    // Show edit lecturer modal
  }

  updateModuleLecturers(module: any) {
    console.log('Updating module lecturers:', module);
    // Save the updated lecturer assignments for the module
  }

  // Group Management
  groupViewChanged() {
    console.log('Group view changed to:', this.groupView);
  }

  get filteredGroups() {
    if (!this.groupSearch) return this.groups;
    return this.groups.filter(group =>
      group.name.toLowerCase().includes(this.groupSearch.toLowerCase()) ||
      group.program.toLowerCase().includes(this.groupSearch.toLowerCase())
    );
  }

  addGroup() {
    console.log('Adding new group');
    // Show add group modal
  }

  editGroup(group: Group) {
    console.log('Editing group:', group);
    // Show edit group modal
  }

  loadGroupTimetable() {
    console.log('Loading timetable for group:', this.selectedGroupForTimetable);
    // Load timetable data for selected group
  }

  hasGroupSession(groupId: number | null, day: string, timeSlot: string): boolean {
    if (!groupId) return false;

    return this.timetableSessions.some(session =>
      session.groupId === groupId && session.day === day && session.timeSlot === timeSlot
    );
  }

  getGroupSession(groupId: number | null, day: string, timeSlot: string): any {
    if (!groupId) return null;

    return this.timetableSessions.find(session =>
      session.groupId === groupId && session.day === day && session.timeSlot === timeSlot
    );
  }

  getGroupById(groupId: number | null): Group | undefined {
    if (!groupId) return undefined;
    return this.groups.find(g => g.id === groupId);
  }

  // Module Management
  get filteredModules() {
    if (!this.moduleSearch) return this.modules;
    return this.modules.filter(module =>
      module.name.toLowerCase().includes(this.moduleSearch.toLowerCase()) ||
      module.code.toLowerCase().includes(this.moduleSearch.toLowerCase())
    );
  }

  async showAddModuleModal() {
    const modal = await this.modalController.create({
      component: AddModuleComponent,
      componentProps: {
        module: null,
        currentUserRole: 'HOD',
        lecturers: this.lecturers.map(l => ({ id: l.id, name: l.name }))
      },
      cssClass: 'module-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data) {
      console.log('Module data returned:', data);
      this.handleNewModuleCreation(data);
    }
  }

  private handleNewModuleCreation(moduleData: Module) {
    console.log('Creating new module:', moduleData);
    moduleData.department = this.departmentInfo.name;

    this.moduleService.addModule(moduleData).subscribe({
      next: (result) => {
        if (result.success) {
          this.presentToast('Module added successfully');
          this.loadDepartmentModules();
        } else {
          this.presentToast(`Error adding module: ${result.message}`);
        }
      },
      error: (error) => {
        console.error('Error adding module:', error);
        this.presentToast('Error adding module: ' + (error.message || 'Unknown error'));
      }
    });
  }

    loadDepartmentModules() {
      this.moduleService.getDepartmentModules().subscribe({
        next: (modules) => {
          console.log('Department modules loaded:', modules);
          this.modules = modules.map(module => ({
            id: module.id,
            code: module.code,
            name: module.name,
            credits: module.credits,
            sessionsPerWeek: module.sessionsPerWeek,
            groupCount: module.groupCount,
            lecturerCount: module.lecturerCount,
            lecturerIds: module.lecturerIds
          }));
          this.departmentStats.modules = this.modules.length;
        },
        error: (error) => {
          console.error('Error loading department modules:', error);
          this.presentToast('Error loading modules: ' + (error.message || 'Unknown error'));
        }
      });
    }


  editModule(module: any) {
    console.log('Editing module:', module);
    // Show edit module modal
  }

  // Submission History
  getSubmissionIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'document-text';
    }
  }

  getSubmissionColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'pending': return 'warning';
      default: return 'medium';
    }
  }

  // Venue Availability Methods
  openVenueAvailability(session?: any) {
    console.log('Opening venue availability modal');

    if (session) {
      this.currentSession = session;
    }

    this.showVenueModal = true;
  }

  closeVenueModal() {
    this.showVenueModal = false;
    this.currentSession = null;
  }

  // Create mock venues if database load fails
  createMockVenues() {
    console.log('Creating mock venues as fallback');
    this.availableVenues = [
      {
        id: '1',
        name: 'Room A101',
        type: 'Lecture Hall',
        capacity: 50,
        equipment: ['Projector', 'Whiteboard', 'Sound System'],
        building: 'Academic Block A',
        room: 'A101',
        floor: 1,
        image: 'assets/default-venue.jpg',
        description: 'Standard lecture hall with modern equipment',
        department: 'General',
        site: 'Main Campus',
        schedulable: true,
        autoSchedulable: true,
        accessibility: {
          deafLoop: false,
          wheelchairAccess: true
        },
        availability: true
      },
      {
        id: '2',
        name: 'Lab L201',
        type: 'Computer Lab',
        capacity: 30,
        equipment: ['Computers', 'Projector', 'Air Conditioning'],
        building: 'Science Block',
        room: 'L201',
        floor: 2,
        image: 'assets/default-venue.jpg',
        description: 'Computer lab with 30 workstations',
        department: 'Computer Science',
        site: 'Main Campus',
        schedulable: true,
        autoSchedulable: true,
        accessibility: {
          deafLoop: false,
          wheelchairAccess: true
        },
        availability: true
      }
    ];
  }

  // Extract room name from venue name or ID
  extractRoomFromVenueName(venueName: string, venueId: string): string {
    // Try to extract room number from venue name
    const roomMatch = venueName.match(/([A-Z]\d+)/);
    if (roomMatch) {
      return roomMatch[1];
    }

    // Fallback to using part of venue ID
    return venueId.substring(0, 4).toUpperCase();
  }

  // Extract floor from venue ID (simple logic)
  extractFloorFromVenueId(venueId: string): number {
    // Simple logic: use second character of ID to determine floor
    const floorNum = venueId.charAt(1) || '1';
    return parseInt(floorNum);
  }

  // Helper method to get ordinal suffix
  getOrdinalSuffix(num: number): string {
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }

    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  // Conflict Resolution Methods
  toggleConflictResolver() {
    this.showConflictResolver = !this.showConflictResolver;

    if (this.showConflictResolver) {
      this.detectTimetableConflicts();
    }
  }

  detectTimetableConflicts() {
    console.log('Detecting timetable conflicts');
    this.departmentConflicts = [];

    // Check for venue conflicts
    for (let i = 0; i < this.timetableSessions.length; i++) {
      for (let j = i + 1; j < this.timetableSessions.length; j++) {
        const session1 = this.timetableSessions[i];
        const session2 = this.timetableSessions[j];

        // Check if sessions overlap in time and day
        if (session1.day === session2.day && session1.timeSlot === session2.timeSlot) {
          // Venue conflict
          if (session1.venueId === session2.venueId) {
            const venueConflict: Conflict = {
              id: this.departmentConflicts.length + 1,
              type: ConflictType.VENUE,
              priority: 'high',
              sessions: [this.convertToTimetableSession(session1), this.convertToTimetableSession(session2)],
              details: `Venue conflict: ${session1.venue} is double-booked on ${session1.day} at ${session1.timeSlot}`,
              possibleResolutions: [
                {
                  id: 1,
                  type: 'Relocate',
                  action: 'changeVenue',
                  newVenue: this.findAlternativeVenue(session1.venueId)
                },
                {
                  id: 2,
                  type: 'Reschedule',
                  action: 'changeTime',
                  newDay: this.findAlternativeDay(session1.day),
                  newStartSlot: this.findAlternativeTimeSlot(session1.timeSlot)
                }
              ],
              resolved: false
            };
            this.departmentConflicts.push(venueConflict);
          }

          // Lecturer conflict
          if (session1.lecturerId === session2.lecturerId) {
            const lecturerConflict: Conflict = {
              id: this.departmentConflicts.length + 1,
              type: ConflictType.LECTURER,
              priority: 'high',
              sessions: [this.convertToTimetableSession(session1), this.convertToTimetableSession(session2)],
              details: `Lecturer conflict: ${session1.lecturer} is scheduled for multiple sessions on ${session1.day} at ${session1.timeSlot}`,
              possibleResolutions: [
                {
                  id: 3,
                  type: 'Reschedule',
                  action: 'changeTime',
                  newDay: this.findAlternativeDay(session1.day),
                  newStartSlot: this.findAlternativeTimeSlot(session1.timeSlot)
                }
              ],
              resolved: false
            };
            this.departmentConflicts.push(lecturerConflict);
          }

          // Group conflict
          if (session1.groupId === session2.groupId) {
            const groupConflict: Conflict = {
              id: this.departmentConflicts.length + 1,
              type: ConflictType.GROUP,
              priority: 'medium',
              sessions: [this.convertToTimetableSession(session1), this.convertToTimetableSession(session2)],
              details: `Group conflict: ${session1.group} has multiple sessions scheduled on ${session1.day} at ${session1.timeSlot}`,
              possibleResolutions: [
                {
                  id: 4,
                  type: 'Reschedule',
                  action: 'changeTime',
                  newDay: this.findAlternativeDay(session1.day),
                  newStartSlot: this.findAlternativeTimeSlot(session1.timeSlot)
                }
              ],
              resolved: false
            };
            this.departmentConflicts.push(groupConflict);
          }
        }
      }
    }

    console.log('Detected conflicts:', this.departmentConflicts.length);
  }

  // Convert SessionForGrid to TimetableSession
  convertToTimetableSession(session: SessionForGrid): TimetableSession {
    const dayMap: { [key: string]: number } = {
      'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4
    };

    const timeSlotParts = session.timeSlot.split(' - ');
    const startHour = parseInt(timeSlotParts[0].split(':')[0]);
    const endHour = parseInt(timeSlotParts[1].split(':')[0]);

    return {
      id: session.id,
      title: session.moduleName,
      module: session.moduleName,
      moduleCode: this.getModuleCode(session.moduleId),
      lecturer: session.lecturer,
      venue: session.venue,
      group: session.group,
      day: dayMap[session.day],
      startSlot: startHour - 8,
      endSlot: endHour - 8,
      category: this.getModuleCategory(session.moduleId),
      color: this.getModuleColor(session.moduleId),
      departmentId: this.departmentInfo.id,
      hasConflict: session.hasConflict
    };
  }

  // Helper methods for conflict resolution
  findAlternativeVenue(currentVenueId: string): string {
    const currentVenue = this.availableVenues.find(v => v.id === currentVenueId);
    const alternatives = this.availableVenues.filter(v =>
      v.id !== currentVenueId &&
      v.type === currentVenue?.type &&
      v.capacity >= (currentVenue?.capacity || 0)
    );

    return alternatives.length > 0 ? alternatives[0].name : 'Alternative Venue';
  }

  findAlternativeDay(currentDay: string): number {
    const dayMap: { [key: string]: number } = {
      'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4
    };

    const currentDayNum = dayMap[currentDay];
    const nextDay = (currentDayNum + 1) % 5; // Cycle through weekdays

    return nextDay;
  }

  findAlternativeTimeSlot(currentTimeSlot: string): number {
    const startHour = parseInt(currentTimeSlot.split(' - ')[0].split(':')[0]);
    const currentSlot = startHour - 8;

    // Try to find next available slot
    const nextSlot = (currentSlot + 1) % 9; // Assuming 9 time slots per day

    return nextSlot;
  }

  // Handle conflict resolution
  handleConflictResolution(event: { conflict: Conflict, resolution: ConflictResolution }) {
    console.log('Resolving conflict:', event);

    const { conflict, resolution } = event;

    // Find the session to update
    const sessionToUpdate = this.timetableSessions.find(
      s => s.id === conflict.sessions[0].id
    );

    if (sessionToUpdate) {
      // Apply the resolution
      if (resolution.action === 'changeVenue' && resolution.newVenue) {
        sessionToUpdate.venue = resolution.newVenue;
        sessionToUpdate.venueId = this.findVenueIdByName(resolution.newVenue);
      } else if (resolution.action === 'changeTime') {
        if (resolution.newDay !== undefined) {
          const dayMap = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
          sessionToUpdate.day = dayMap[resolution.newDay];
        }

        if (resolution.newStartSlot !== undefined) {
          const newStartHour = resolution.newStartSlot + 8;
          const newEndHour = newStartHour + 1; // Assuming 1-hour sessions
          sessionToUpdate.timeSlot = `${newStartHour}:00 - ${newEndHour}:00`;
        }
      }

      // Mark session as no longer having conflict
      sessionToUpdate.hasConflict = false;
    }

    // Remove the resolved conflict
    this.departmentConflicts = this.departmentConflicts.filter(c => c.id !== conflict.id);

    // Re-format sessions for the grid
    this.formatTimetableSessions();

    // Re-check for any remaining conflicts
    this.detectTimetableConflicts();

    this.presentToast('Conflict resolved successfully');
  }

  findVenueIdByName(venueName: string): string {
    const venue = this.availableVenues.find(v => v.name === venueName);
    return venue ? venue.id : '1';
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    toast.present();
  }

  logout() {
    console.log('Logging out...');
    this.router.navigate(['/login']);
  }

  // Lecturer Management
  lecturerViewChanged() {
    console.log('Lecturer view changed to:', this.lecturerView);
  }

  async showAddLecturerModal() {
    const modal = await this.modalController.create({
      component: AddUserComponent,
      componentProps: {
        user: null,
        currentUserRole: 'HOD' // HODs can add lecturers
      },
      cssClass: 'user-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    
    if (data) {
      console.log('Lecturer data returned:', data);
      this.handleNewLecturerCreation(data);
    }
  }

  // Handle new lecturer creation for HODs
  private handleNewLecturerCreation(lecturerData: User) {
    console.log('Creating new lecturer:', lecturerData);
    
    // Set the department to the current HOD's department
    lecturerData.department = this.departmentInfo.name;
    
    this.lecturerService.addLecturer(lecturerData).subscribe({
      next: (result) => {
        if (result.success) {
          this.presentToast('Lecturer added successfully');
          this.loadDepartmentLecturers(); // Reload lecturers list
        } else {
          this.presentToast(`Error adding lecturer: ${result.message}`);
        }
      },
      error: (error) => {
        console.error('Error adding lecturer:', error);
        this.presentToast('Error adding lecturer: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // Add bulk upload method for lecturers
  async showBulkUploadModal() {
    const modal = await this.modalController.create({
      component: BulkUploadLecturersComponent,
      cssClass: 'bulk-upload-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    
    if (data && data.success) {
      console.log('Bulk upload completed:', data);
      
      let message = `Successfully added ${data.addedCount} lecturers.`;
      if (data.errors && data.errors.length > 0) {
        message += ` ${data.errors.length} errors occurred.`;
      }
      
      this.presentToast(message);
      this.loadDepartmentLecturers(); // Reload lecturers list
    }
  }

  // Add bulk upload method for modules
  async showBulkUploadModuleModal() {
    const modal = await this.modalController.create({
      component: BulkUploadModulesComponent,
      cssClass: 'bulk-upload-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    
    if (data && data.success) {
      console.log('Bulk upload completed:', data);
      
      let message = `Successfully added ${data.addedCount} Modules.`;
      if (data.errors && data.errors.length > 0) {
        message += ` ${data.errors.length} errors occurred.`;
      }
      
      this.presentToast(message);
      this.loadDepartmentModules(); // Reload modules list
    }
  }

  // Load lecturers from database for the current department
  loadDepartmentLecturers() {
    this.lecturerService.getDepartmentLecturers().subscribe({
      next: (lecturers) => {
        console.log('Department lecturers loaded:', lecturers);
        
        // Update the lecturers array with data from database
        this.lecturers = lecturers.map(lecturer => ({
          id: parseInt(lecturer.id) || 0,
          name: lecturer.name,
          email: lecturer.contact?.email || '',
          avatar: lecturer.profile || 'assets/default-avatar.png',
          moduleCount: 0, // This would be calculated based on module assignments
          weeklyHours: lecturer.weeklyTarget || 0,
          workloadPercentage: (lecturer.weeklyTarget || 0) / 24, // Assuming 24 hours max
          specialization: lecturer.tags?.join(', ') || 'General'
        }));
        
        // Update department stats
        this.departmentStats.lecturers = this.lecturers.length;
      },
      error: (error) => {
        console.error('Error loading department lecturers:', error);
        this.presentToast('Error loading lecturers: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // View submission details
  viewSubmissionDetails(submission: any) {
    console.log('View submission details:', submission);
    this.selectedSubmission = submission;

    // Generate mock timetable data for the selected submission
    this.loadSubmissionTimetable(submission.id);
  }

  // Load timetable for selected submission
  loadSubmissionTimetable(submissionId: number) {
    // In a real app, this would fetch the submission timetable from the backend
    // For now, we'll use mock data based on the submission ID

    // Create a copy of the current timetable with some modifications
    const submissionSessions: SessionForGrid[] = [...this.timetableSessions].map((session: SessionForGrid) => {
      // Add some variations based on submission ID
      return {
        ...session,
        hasConflict: submissionId === 2 ? Math.random() > 0.7 : false // More conflicts for rejected submission
      };
    });

    // Format the sessions for the timetable grid
    this.selectedSubmissionTimetable = submissionSessions.map(session => {
      const dayMap: { [key: string]: number } = {
        'Monday': 0,
        'Tuesday': 1,
        'Wednesday': 2,
        'Thursday': 3,
        'Friday': 4,
        'Saturday': 5,
        'Sunday': 6
      };

      const timeSlotParts = session.timeSlot.split(' - ');
      const startHour = parseInt(timeSlotParts[0].split(':')[0]);
      const endHour = parseInt(timeSlotParts[1].split(':')[0]);

      return {
        id: session.id,
        title: session.moduleName,
        module: session.moduleName,
        moduleCode: this.getModuleCode(session.moduleId),
        lecturer: session.lecturer,
        venue: session.venue,
        group: session.group,
        day: dayMap[session.day],
        startSlot: startHour - 8,
        endSlot: endHour - 8,
        category: this.getModuleCategory(session.moduleId),
        color: session.hasConflict ? '#eb445a' : this.getModuleColor(session.moduleId), // Red color for conflicts
        departmentId: this.departmentInfo.id,
        hasConflict: session.hasConflict
      } as TimetableSession;
    });
  }

  // View details of a session from submission timetable
  viewSubmissionSessionDetails(session: TimetableSession) {
    console.log('Viewing submission session details:', session);
    // Show details of the session, e.g., in a modal
  }
}
