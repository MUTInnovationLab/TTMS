import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { ModalController } from '@ionic/angular';
import { Venue } from '../components/venue-avail/venue-avail.component';
import { Conflict, ConflictResolution, ConflictType } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
// Remove GroupService import temporarily
// import { GroupService } from '../services/group.service';
import { Group } from '../models/group.model';
import { TimetableService, TimetableSession as TimetableServiceSession } from '../services/Timetable Core Services/timetable.service';
import { SessionService, SessionRequest } from '../services/Timetable Core Services/session.service';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';

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

  get filteredGroups() {
    if (!this.groupSearch) return this.groups;
    return this.groups.filter(group =>
      group.name.toLowerCase().includes(this.groupSearch.toLowerCase()) ||
      group.program.toLowerCase().includes(this.groupSearch.toLowerCase())
    );
  }

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

  get filteredModules() {
    if (!this.moduleSearch) return this.modules;
    return this.modules.filter(module =>
      module.name.toLowerCase().includes(this.moduleSearch.toLowerCase()) ||
      module.code.toLowerCase().includes(this.moduleSearch.toLowerCase())
    );
  }

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
    private venueService: VenueService
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
    const newEndHour = newStartHour + (event.session.endSlot - event.session.startSlot);
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

  // Lecturer Management
  lecturerViewChanged() {
    console.log('Lecturer view changed to:', this.lecturerView);
  }

  showAddLecturerModal() {
    console.log('Show add lecturer modal');
  }

  editLecturer(lecturer: any) {
    console.log('Edit lecturer:', lecturer);
    // Show modal to edit lecturer
  }

  updateModuleLecturers(module: any) {
    console.log('Updated module lecturers:', module);
    // Update module lecturers logic
  }

  // Groups Management
  groupViewChanged() {
    console.log('Group view changed to:', this.groupView);
  }

  showAddGroupModal() {
    console.log('Show add group modal');
  }

  addGroup() {
    this.router.navigate(['/hod-dash/add-group']);
  }

  editGroup(group: any) {
    console.log('Edit group:', group);
    // Navigate to group detail page
    this.router.navigate(['/hod-dash/group-detail', group.id]);
  }

  getGroupById(groupId: number) {
    return this.groups.find(group => group.id === groupId);
  }

  loadGroupTimetable() {
    console.log('Loading timetable for group:', this.selectedGroupForTimetable);
    // Load group timetable logic
  }

  hasGroupSession(groupId: number, day: string, timeSlot: string): boolean {
    return this.timetableSessions.some(session =>
      session.groupId === groupId && session.day === day && session.timeSlot === timeSlot
    );
  }

  getGroupSession(groupId: number, day: string, timeSlot: string): any {
    return this.timetableSessions.find(session =>
      session.groupId === groupId && session.day === day && session.timeSlot === timeSlot
    );
  }

  // Modules Management
  showAddModuleModal() {
    console.log('Show add module modal');
  }

  editModule(module: any) {
    console.log('Edit module:', module);
    // Show modal to edit module
  }

  // Submission History
  getSubmissionIcon(status: string): string {
    switch (status) {
      case 'Approved': return 'checkmark-circle';
      case 'Rejected': return 'close-circle';
      case 'Pending': return 'time';
      default: return 'document';
    }
  }

  getSubmissionColor(status: string): string {
    switch (status) {
      case 'Approved': return 'success';
      case 'Rejected': return 'danger';
      case 'Pending': return 'warning';
      default: return 'medium';
    }
  }

  // Load venues from database
  loadVenues() {
    console.log('HOD: Loading venues from database');
    this.venuesLoading = true;
    
    // First test the database connection
    this.venueService.testDatabaseConnection().subscribe({
      next: (result) => {
        console.log('HOD: Database connection test result:', result);
      },
      error: (error) => {
        console.error('HOD: Database connection test error:', error);
      }
    });
    
    // Load venues directly from service
    this.venueService.getAllVenues().subscribe({
      next: (venues) => {
        console.log('HOD: Venues loaded successfully from database:', venues.length);
        
        if (venues.length === 0) {
          console.warn('HOD: No venues found in database');
          this.alertController.create({
            header: 'No Venues Available',
            message: 'No schedulable venues were found in the database. Please contact your administrator.',
            buttons: [
              {
                text: 'Use Demo Data',
                handler: () => {
                  this.createMockVenues();
                }
              },
              {
                text: 'OK'
              }
            ]
          }).then(alert => alert.present());
          
        } else {
          // Transform VenueDisplayInfo to Venue format for the venue availability component
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
            // Add missing properties that the venue-avail component expects
            building: venue.site || 'Unknown Building',
            room: this.extractRoomFromVenueName(venue.name, venue.id),
            image: 'assets/default-venue.jpg',
            description: `${venue.type} located at ${venue.site} with capacity of ${venue.capacity}`,
            floor: this.extractFloorFromVenueId(venue.id),
            availability: true
          }));
          
          console.log('HOD: Transformed venues for venue-avail component:', this.availableVenues.length);
          console.log('HOD: Sample venue after transformation:', this.availableVenues[0]);
        }
        this.venuesLoading = false;
      },
      error: (error) => {
        console.error('HOD: Error loading venues from database:', error);
        this.venuesLoading = false;
        
        // Show error message with retry option
        this.alertController.create({
          header: 'Database Error',
          message: `Failed to load venues: ${error.message}. Please check your connection and try again.`,
          buttons: [
            {
              text: 'Retry',
              handler: () => {
                this.loadVenues();
              }
            },
            {
              text: 'Use Demo Data',
              handler: () => {
                this.createMockVenues();
              }
            }
          ]
        }).then(alert => alert.present());
      }
    });
  }

  // Helper method to extract room from venue name or ID
  private extractRoomFromVenueName(name: string, id: string): string {
    // Try to extract room from name like "LECTURE THEATRE - NW1"
    const nameMatch = name.match(/- (\w+\d+)$/);
    if (nameMatch) {
      return nameMatch[1];
    }
    
    // Try to extract from ID like "1000_0_NW1"
    const idParts = id.split('_');
    if (idParts.length >= 3) {
      return idParts[2];
    }
    
    return name;
  }

  // Helper method to extract floor from venue ID
  private extractFloorFromVenueId(id: string): number {
    const parts = id.split('_');
    if (parts.length >= 2) {
      const floor = parseInt(parts[1]);
      return isNaN(floor) ? 0 : floor;
    }
    return 0;
  }

  // Open venue availability modal
  async openVenueAvailability(session?: any) {
    this.currentSession = session || {};
    
    console.log('HOD: Opening venue availability modal');
    console.log('HOD: Available venues count:', this.availableVenues.length);
    
    // Check if venues are available
    if (this.availableVenues.length === 0) {
      console.log('HOD: No venues available, showing error');
      this.alertController.create({
        header: 'No Venues Available',
        message: 'No venues are currently loaded. Please wait for venues to load or contact support.',
        buttons: [
          {
            text: 'Reload Venues',
            handler: () => {
              this.loadVenuesAndInitialize();
            }
          },
          {
            text: 'OK'
          }
        ]
      }).then(alert => alert.present());
      return;
    }
    
    // Open the modal
    console.log('HOD: Opening modal with venues:', this.availableVenues.length);
    this.showVenueModal = true;
  }

  // Close venue availability modal
  closeVenueModal() {
    this.showVenueModal = false;
  }
  
  // Create mock venues for demo purposes
  private createMockVenues() {
    console.log('Creating mock venues for demo purposes');
    
    this.availableVenues = [
      {
        id: '1000_0_LT1',
        name: 'Lecture Theatre 1',
        type: 'Lecture Theatre',
        capacity: 200,
        equipment: ['Projector', 'Computer', 'Whiteboard'],
        department: 'Central',
        site: 'Main Building',
        schedulable: true,
        autoSchedulable: true,
        // accessibility: true,
        building: 'Main Building',
        room: 'LT1',
        image: 'assets/default-venue.jpg',
        description: 'Large lecture theatre located in the Main Building',
        floor: 0,
        availability: true
      },
      {
        id: '1001_1_CR1',
        name: 'Classroom 1',
        type: 'Classroom',
        capacity: 50,
        equipment: ['Projector', 'Computer'],
        department: 'Computer Science',
        site: 'CS Building',
        schedulable: true,
        autoSchedulable: true,
        // accessibility: true,
        building: 'CS Building',
        room: 'CR1',
        image: 'assets/default-venue.jpg',
        description: 'Standard classroom in the CS Building',
        floor: 1,
        availability: true
      },
      {
        id: '1002_1_LAB1',
        name: 'Computer Lab 1',
        type: 'Laboratory',
        capacity: 30,
        equipment: ['Computers', 'Projector', 'Specialized Software'],
        department: 'Computer Science',
        site: 'CS Building',
        schedulable: true,
        autoSchedulable: true,
        // accessibility: true,
        building: 'CS Building',
        room: 'LAB1',
        image: 'assets/default-venue.jpg',
        description: 'Computer laboratory with 30 workstations',
        floor: 1,
        availability: true
      }
    ];
    
    console.log('Created mock venues:', this.availableVenues.length);
  }

  // Toggle conflict resolver visibility
  toggleConflictResolver() {
    this.showConflictResolver = !this.showConflictResolver;

    // Re-detect conflicts if needed
    if (this.showConflictResolver && this.departmentConflicts.length === 0) {
      this.detectTimetableConflicts();
    }
  }

  // Detect conflicts in the timetable
  detectTimetableConflicts() {
    // Clear existing conflicts
    this.departmentConflicts = [];

    // Create lookup maps for faster conflict detection
    const sessions = this.timetableSessions;

    // 1. Detect venue conflicts (same venue, same time)
    this.detectVenueConflicts(sessions);

    // 2. Detect lecturer conflicts (same lecturer, same time)
    this.detectLecturerConflicts(sessions);

    // 3. Detect group conflicts (same group, same time)
    this.detectGroupConflicts(sessions);

    // Update notification count
    this.notificationCount = Math.max(this.departmentConflicts.length, this.notificationCount);

    // Update UI elements
    this.canSubmitTimetable = this.departmentConflicts.length === 0;
  }

  // Detect venue conflicts
  private detectVenueConflicts(sessions: any[]) {
    // Group sessions by venue and day
    const venueMap: { [key: string]: any[] } = {};

    sessions.forEach(session => {
      const key = `${session.venue}-${session.day}-${session.timeSlot}`;
      if (!venueMap[key]) {
        venueMap[key] = [];
      }
      venueMap[key].push(session);
    });

    // Create conflicts for venues with multiple sessions
    Object.values(venueMap).forEach(venueSessions => {
      if (venueSessions.length > 1) {
        // Create conflict
        const conflictSessions: TimetableSession[] = venueSessions.map(session => this.convertToTimetableSession(session));

        // Get alternative venues
        const alternativeVenues = this.availableVenues
          .filter(venue => venue.name !== venueSessions[0].venue)
          .map(venue => venue.name);

        // Create possible resolutions
        const possibleResolutions: ConflictResolution[] = [
          {
            id: this.getNextResolutionId(),
            type: 'Relocate',
            action: 'changeVenue',
            newVenue: alternativeVenues[0] || 'TBD'
          },
          {
            id: this.getNextResolutionId(),
            type: 'Reschedule',
            action: 'changeTime',
            newDay: this.getNextAvailableDay(venueSessions[0].day),
            newStartSlot: this.convertTimeToSlot(venueSessions[0].timeSlot.split(' - ')[0]),
            newEndSlot: this.convertTimeToSlot(venueSessions[0].timeSlot.split(' - ')[1])
          }
        ];

        const conflict: Conflict = {
          id: this.departmentConflicts.length + 1,
          type: ConflictType.VENUE,
          priority: 'high',
          sessions: conflictSessions,
          details: `Venue ${venueSessions[0].venue} is double-booked on ${venueSessions[0].day} at ${venueSessions[0].timeSlot}`,
          possibleResolutions,
          resolved: false
        };

        this.departmentConflicts.push(conflict);

        // Mark sessions as having conflicts
        venueSessions.forEach(session => {
          session.hasConflict = true;
        });
      }
    });
  }

  // Detect lecturer conflicts
  private detectLecturerConflicts(sessions: any[]) {
    // Group sessions by lecturer and day
    const lecturerMap: { [key: string]: any[] } = {};

    sessions.forEach(session => {
      const key = `${session.lecturer}-${session.day}-${session.timeSlot}`;
      if (!lecturerMap[key]) {
        lecturerMap[key] = [];
      }
      lecturerMap[key].push(session);
    });

    // Create conflicts for lecturers with multiple sessions
    Object.values(lecturerMap).forEach(lecturerSessions => {
      if (lecturerSessions.length > 1) {
        // Create conflict
        const conflictSessions: TimetableSession[] = lecturerSessions.map(session => this.convertToTimetableSession(session));

        // Create possible resolutions
        const possibleResolutions: ConflictResolution[] = [
          {
            id: this.getNextResolutionId(),
            type: 'Reschedule',
            action: 'changeTime',
            newDay: this.getNextAvailableDay(lecturerSessions[0].day),
            newStartSlot: this.convertTimeToSlot(lecturerSessions[0].timeSlot.split(' - ')[0]),
            newEndSlot: this.convertTimeToSlot(lecturerSessions[0].timeSlot.split(' - ')[1])
          }
        ];

        const conflict: Conflict = {
          id: this.departmentConflicts.length + 1,
          type: ConflictType.LECTURER,
          priority: 'high',
          sessions: conflictSessions,
          details: `${lecturerSessions[0].lecturer} is scheduled for multiple classes on ${lecturerSessions[0].day} at ${lecturerSessions[0].timeSlot}`,
          possibleResolutions,
          resolved: false
        };

        this.departmentConflicts.push(conflict);

        // Mark sessions as having conflicts
        lecturerSessions.forEach(session => {
          session.hasConflict = true;
        });
      }
    });
  }

  // Detect group conflicts
  private detectGroupConflicts(sessions: any[]) {
    // Group sessions by group and day
    const groupMap: { [key: string]: any[] } = {};

    sessions.forEach(session => {
      const key = `${session.group}-${session.day}-${session.timeSlot}`;
      if (!groupMap[key]) {
        groupMap[key] = [];
      }
      groupMap[key].push(session);
    });

    // Create conflicts for groups with multiple sessions
    Object.values(groupMap).forEach(groupSessions => {
      if (groupSessions.length > 1) {
        // Create conflict
        const conflictSessions: TimetableSession[] = groupSessions.map(session => this.convertToTimetableSession(session));

        // Create possible resolutions
        const possibleResolutions: ConflictResolution[] = [
          {
            id: this.getNextResolutionId(),
            type: 'Reschedule',
            action: 'changeTime',
            newDay: this.getNextAvailableDay(groupSessions[0].day),
            newStartSlot: this.convertTimeToSlot(groupSessions[0].timeSlot.split(' - ')[0]),
            newEndSlot: this.convertTimeToSlot(groupSessions[0].timeSlot.split(' - ')[1])
          },
          {
            id: this.getNextResolutionId(),
            type: 'Split Group',
            action: 'splitGroup'
          }
        ];

        const conflict: Conflict = {
          id: this.departmentConflicts.length + 1,
          type: ConflictType.GROUP,
          priority: 'medium',
          sessions: conflictSessions,
          details: `${groupSessions[0].group} has multiple classes on ${groupSessions[0].day} at ${groupSessions[0].timeSlot}`,
          possibleResolutions,
          resolved: false
        };

        this.departmentConflicts.push(conflict);

        // Mark sessions as having conflicts
        groupSessions.forEach(session => {
          session.hasConflict = true;
        });
      }
    });
  }

  // Handle resolution of conflicts
  handleConflictResolution(event: { conflict: Conflict, resolution: ConflictResolution }) {
    console.log('Conflict resolution:', event);
    const { conflict, resolution } = event;

    // 1. Find affected sessions
    const affectedSessions = this.timetableSessions.filter(session => {
      return conflict.sessions.some(s => s.id === session.id);
    });

    // 2. Apply resolution based on action type
    switch (resolution.action) {
      case 'changeVenue':
        if (resolution.newVenue) {
          // Apply venue change
          affectedSessions.forEach(session => {
            if (session.id === conflict.sessions[0].id) {
              session.venue = resolution.newVenue || session.venue;
              session.hasConflict = false;
            }
          });
        }
        break;

      case 'changeTime':
        if (resolution.newDay !== undefined && resolution.newStartSlot !== undefined && resolution.newEndSlot !== undefined) {
          // Apply time change
          const sessionToChange = affectedSessions.find(s => s.id === conflict.sessions[0].id);
          if (sessionToChange) {
            // Convert the day and time slots to the right format
            const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const newDay = dayMap[resolution.newDay];
            const newStartTime = this.convertSlotToTime(resolution.newStartSlot);
            const newEndTime = this.convertSlotToTime(resolution.newEndSlot);

            sessionToChange.day = newDay;
            sessionToChange.timeSlot = `${newStartTime} - ${newEndTime}`;
            sessionToChange.hasConflict = false;
          }
        }
        break;

      case 'splitGroup':
        // Handle group splitting (more complex - would require UI for assignment)
        // For this example, just mark as resolved
        affectedSessions.forEach(session => {
          session.hasConflict = false;
        });
        break;
    }

    // 3. Re-format all sessions
    this.formatTimetableSessions();

    // 4. Re-detect remaining conflicts
    this.detectTimetableConflicts();

    // 5. Hide conflict resolver if all conflicts are resolved
    if (this.departmentConflicts.length === 0) {
      this.showConflictResolver = false;
    }
  }

  // Helper to convert time string to slot number (8:00 -> 0, 9:00 -> 1, etc.)
  private convertTimeToSlot(timeString: string): number {
    const hour = parseInt(timeString.split(':')[0]);
    return hour - 8; // Assuming 8am is slot 0
  }

  // Helper to convert slot to time string
  private convertSlotToTime(slot: number): string {
    const hour = slot + 8; // Assuming 8am is slot 0
    return `${hour}:00`;
  }

  // Helper to get next available day (simple implementation)
  private getNextAvailableDay(currentDay: string): number {
    const dayMap = {
      'Monday': 0,
      'Tuesday': 1,
      'Wednesday': 2,
      'Thursday': 3,
      'Friday': 4,
      'Saturday': 5,
      'Sunday': 6
    };

    // Get current day index and return next day (wrap around to Monday if Friday)
    const currentDayIndex = dayMap[currentDay as keyof typeof dayMap];
    return (currentDayIndex + 1) % 5; // Only use Monday-Friday (0-4)
  }

  // Convert session to TimetableSession format for conflict component
  private convertToTimetableSession(session: any): TimetableSession {
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

    return {
      id: session.id,
      title: session.moduleName,
      module: this.getModuleNameById(session.moduleId),
      moduleCode: this.getModuleCode(session.moduleId),
      lecturer: session.lecturer,
      venue: session.venue,
      group: session.group,
      day: dayMap[session.day],
      startSlot: startHour - 8, // Assuming 8am is the first slot (slot 0)
      endSlot: endHour - 8,     // Assuming 9am is the second slot (slot 1), etc.
      category: this.getModuleCategory(session.moduleId),
      color: session.hasConflict ? '#eb445a' : this.getModuleColor(session.moduleId),
      departmentId: this.departmentInfo.id,
      hasConflict: session.hasConflict
    } as TimetableSession;
  }

  // Helper to get module name by ID
  private getModuleNameById(moduleId: number): string {
    const module = this.modules.find(m => m.id === moduleId);
    return module ? module.name : 'Unknown Module';
  }

  // Generate a unique resolution ID
  private getNextResolutionId(): number {
    let maxId = 0;
    this.departmentConflicts.forEach(conflict => {
      conflict.possibleResolutions.forEach(resolution => {
        if (resolution.id > maxId) {
          maxId = resolution.id;
        }
      });
    });
    return maxId + 1;
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Logout',
          handler: () => {
            this.performLogout();
          }
        }
      ]
    });

    await alert.present();
  }

  performLogout() {
    // Clear any stored user data, tokens, etc.
    // localStorage.removeItem('authToken');
    // sessionStorage.clear();

    // Navigate to home page
    this.router.navigate(['/home']);

    console.log('User logged out successfully');
  }
}



