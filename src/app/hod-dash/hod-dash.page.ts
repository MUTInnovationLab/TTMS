import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { ModalController } from '@ionic/angular';
import { Venue } from '../components/venue-avail/venue-avail.component';
import { Conflict, ConflictResolution, ConflictType } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Group } from '../models/group.model';
import { SessionForGrid, SessionForm } from '../models/session.model';
import { User } from '../components/add-user/add-user.component';
import { TimetableService, TimetableSession as TimetableServiceSession } from '../services/Timetable Core Services/timetable.service';
import { TimetableDatabaseService } from '../services/Timetable Core Services/timetable-database.service';
import { SessionService, SessionRequest } from '../services/Timetable Core Services/session.service';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';
import { AddUserComponent } from '../components/add-user/add-user.component';
import { BulkUploadLecturersComponent } from '../components/bulk-upload-lecturers/bulk-upload-lecturers.component';
import { LecturerService } from '../services/Entity Management Services/lecturer.service';
import { BulkUploadModulesComponent } from '../components/bulk-upload-modules/bulk-upload-modules.component';
import { ModuleService, Module } from '../services/Entity Management Services/module.service';
import { AddModuleComponent } from '../components/add-module/add-module.component';
import { AuthService } from '../services/Authentication Services/auth.service';
import { UserService, DepartmentInfo, DepartmentStats } from '../services/Authentication Services/user.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
// Temporarily comment out GroupService to resolve circular dependency
// import { GroupService } from '../services/group.service';

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

  // Department Info - will be loaded from database
  departmentInfo: DepartmentInfo = {
    id: '',
    name: 'Loading...',
    hodName: 'Loading...',
    email: '',
    phone: '',
    location: ''
  };

  // Department Statistics - will be calculated from database
  departmentStats: DepartmentStats = {
    lecturers: 0,
    groups: 0,
    modules: 0,
    sessions: 0,
    students: 0
  };

  // Submission Status
  submissionStatus = {
    status: 'in-progress', // Options: draft, in-progress, submitted, rejected, incomplete
    label: 'In Progress',
    message: 'Complete your timetable by May 30, 2023 to meet the submission deadline.',
    canEdit: true,
    buttonText: 'Edit Timetable'
  };

  // Conflicts - will be loaded from database and calculated dynamically
  conflicts: any[] = [];

  // Recent Sessions - will be loaded from database
  recentSessions: any[] = [];

  // Timetable Data
  weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  timeSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'];

  timetableFilters = {
    lecturer: null,
    group: null,
    module: null
  };

  // Timetable sessions - will be loaded from database
  timetableSessions: SessionForGrid[] = [];

  canSubmitTimetable = true;

  // Lecturers Data - Remove static data, make it dynamic
  lecturerSearch = '';
  lecturerView = 'list';

  // Remove static lecturer data - will be loaded from database
  lecturers: any[] = [];

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

  // Initialize with empty array - data will be loaded from database
  groups: Group[] = [];

  // Modules Data - will be loaded from database
  moduleSearch = '';
  modules: any[] = [];

  // Submission History - will be loaded from database
  submissionHistory: any[] = [];

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
  // Department ID - will be set from current user's department
  private departmentId: number = 0;
  sessionToAdd: SessionForm | null = null;
  private autoSaveInterval: any; // For auto-save functionality
  lastSaveTime: Date | null = null; // Make this public for template access

  constructor(
    private alertController: AlertController,
    private router: Router,
    private modalController: ModalController,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private timetableService: TimetableService,
    private timetableDatabaseService: TimetableDatabaseService,
    private sessionService: SessionService,
    private venueService: VenueService,
    private lecturerService: LecturerService,
    private toastController: ToastController,
    private moduleService: ModuleService,
    private authService: AuthService,
    private userService: UserService,
    private firestore: AngularFirestore // Add Firestore directly to load groups
  ) {
    console.log('HodDashPage constructor');
  }

  ngOnInit() {
    console.log('HodDashPage ngOnInit');

    // Load current user's department information first
    this.loadCurrentUserDepartment();

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

    // Load all department data from database
    this.loadDepartmentModules();
    this.loadDepartmentGroups();
    this.loadRecentSessions();
    this.loadSubmissionStatusFromDatabase();

    // Start auto-save functionality (save every 30 seconds)
    this.startAutoSave();
  }

  // Updated method to load current user's department with real data
  loadCurrentUserDepartment() {
    const currentUserObservable = this.authService.getCurrentUser();

    if (currentUserObservable) {
      currentUserObservable.subscribe({
        next: (currentUser) => {
          if (currentUser && currentUser.department) {
            console.log('Current user department loaded:', currentUser.department);

            // Load department information from database
            this.loadDepartmentInfo(currentUser.department);
            
            // Load department statistics
            this.loadDepartmentStats(currentUser.department);

            // Load department-specific data after department is determined
            this.loadDepartmentLecturers();
          } else {
            console.warn('No department found for current user');
            this.presentToast('Warning: Unable to determine your department. Some features may not work correctly.');
            
            // Set fallback department info
            this.setFallbackDepartmentInfo();
          }
        },
        error: (error) => {
          console.error('Error loading current user department:', error);
          this.presentToast('Error loading department information');
          this.setFallbackDepartmentInfo();
        }
      });
    } else {
      console.warn('No current user observable available');
      this.setFallbackDepartmentInfo();
    }
  }

  // Load department information from database
  private loadDepartmentInfo(departmentName: string) {
    console.log('Loading department info for:', departmentName);
    
    this.userService.getDepartmentInfo(departmentName).subscribe({
      next: (departmentInfo) => {
        if (departmentInfo) {
          console.log('Department info loaded:', departmentInfo);
          this.departmentInfo = departmentInfo;
          
          // Set departmentId from the loaded info
          this.departmentId = parseInt(departmentInfo.id) || 0;
          
          this.cdr.detectChanges();
          
          // Load submission history after department is loaded
          this.loadSubmissionHistoryFromDatabase();
        } else {
          console.warn('Department info not found, using fallback');
          this.setFallbackDepartmentInfo(departmentName);
        }
      },
      error: (error) => {
        console.error('Error loading department info:', error);
        this.presentToast('Error loading department information');
        this.setFallbackDepartmentInfo(departmentName);
      }
    });
  }

  // Load department statistics from database
  private loadDepartmentStats(departmentName: string) {
    console.log('Loading department stats for:', departmentName);
    
    this.userService.getDepartmentStats(departmentName).subscribe({
      next: (stats) => {
        console.log('Department stats loaded:', stats);
        this.departmentStats = stats;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading department stats:', error);
        this.presentToast('Error loading department statistics');
      }
    });
  }

  // Set fallback department info when database load fails
  private setFallbackDepartmentInfo(departmentName?: string) {
    const currentAuthState = this.authService.getCurrentAuthState();
    
    this.departmentInfo = {
      id: departmentName || 'unknown',
      name: departmentName || 'Unknown Department',
      hodName: currentAuthState.email || 'Unknown HOD',
      email: currentAuthState.email || '',
      phone: 'Not available',
      location: 'Location not specified'
    };
    
    this.cdr.detectChanges();
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
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Save final state before leaving
    this.saveTimetable();
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

  // Select lecturer for the session - use dynamic lecturer data
  async selectLecturerForSession() {
    if (this.lecturers.length === 0) {
      this.alertController.create({
        header: 'No Lecturers Available',
        message: 'Please add lecturers to your department first.',
        buttons: ['OK']
      }).then(alert => alert.present());
      return;
    }

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

        // Auto-save after creating session
        this.autoSaveTimetable();

        // Show success message
        this.alertController.create({
          header: 'Success',
          message: 'Session has been added to the timetable and saved',
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
        'Friday': 4
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
        departmentId: parseInt(this.departmentInfo.id) || 1,
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
      
      // Auto-save the changes
      this.autoSaveTimetable();
      
      // Show success message
      this.presentToast(`Session "${event.session.title}" moved to ${newDay} at ${newTimeSlot}`);
    }
  }

  // Handle session delete from timetable grid
  async handleSessionDelete(session: TimetableSession) {
    console.log('Session delete requested:', session);

    // Show confirmation dialog
    const alert = await this.alertController.create({
      header: 'Delete Session',
      message: `Are you sure you want to delete "${session.title}" session?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: () => {
            this.deleteSession(session);
          }
        }
      ]
    });

    await alert.present();
  }

  // Delete session from timetable
  private deleteSession(session: TimetableSession) {
    console.log('Deleting session:', session);

    // Use the session service to delete the session
    this.sessionService.deleteSession(session.id).subscribe({
      next: (success) => {
        if (success) {
          console.log('Session deleted successfully');
          
          // Remove from local timetable sessions
          this.timetableSessions = this.timetableSessions.filter(s => s.id !== session.id);
          
          // Re-format sessions for the grid
          this.formatTimetableSessions();
          
          // Auto-save the changes
          this.autoSaveTimetable();
          
          // Show success message
          this.presentToast(`Session "${session.title}" deleted successfully`);
          
          // Re-detect conflicts after deletion
          this.detectTimetableConflicts();
        } else {
          console.error('Failed to delete session');
          this.presentToast('Failed to delete session. Please try again.');
        }
      },
      error: (error) => {
        console.error('Error deleting session:', error);
        this.presentToast('Error deleting session: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // New method to get lecturer names from IDs
  getLecturerNames(lecturerIds: number[]): string[] {
    return this.lecturers
      .filter(lecturer => lecturerIds.includes(lecturer.id))
      .map(lecturer => lecturer.name);
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
          console.log('Mapped modules for display:', this.modules);
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
      departmentId: parseInt(this.departmentInfo.id) || 1,
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
    console.log('Loading department lecturers...');
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

        // Update department stats with actual lecturer count
        this.departmentStats = {
          ...this.departmentStats,
          lecturers: this.lecturers.length
        };

        // Update recent sessions to use actual lecturer names if available
        this.updateRecentSessionsWithRealData();
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading department lecturers:', error);
        this.presentToast('Error loading lecturers: ' + (error.message || 'Unknown error'));

        // Initialize empty array on error
        this.lecturers = [];
        this.departmentStats = {
          ...this.departmentStats,
          lecturers: 0
        };
      }
    });
  }

  // Update recent sessions and timetable sessions to use real lecturer data
  updateRecentSessionsWithRealData() {
    // Update recent sessions to use actual lecturer names if they exist
    this.recentSessions = this.recentSessions.map(session => {
      const lecturer = this.lecturers.find(l => l.name === session.lecturer);
      return {
        ...session,
        lecturer: lecturer ? lecturer.name : 'Unknown Lecturer'
      };
    });

    // Update timetable sessions to use actual lecturer data
    this.timetableSessions = this.timetableSessions.map(session => {
      const lecturer = this.lecturers.find(l => l.id === session.lecturerId);
      return {
        ...session,
        lecturer: lecturer ? lecturer.name : 'Unknown Lecturer'
      };
    });

    // Re-format timetable sessions for display
    this.formatTimetableSessions();
  }

  // Load groups from database for the current department
  loadDepartmentGroups() {
    console.log('Loading department groups...');
    
    // Use Firestore directly to avoid circular dependency with GroupService
    this.firestore.collection('groups').valueChanges({ idField: 'id' }).subscribe({
      next: (groups: any[]) => {
        console.log('Department groups loaded:', groups);
        
        // Update the groups array with data from database
        this.groups = groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          program: group.program,
          year: group.year,
          semester: group.semester,
          studentCount: group.studentCount,
          createdAt: group.createdAt?.toDate ? group.createdAt.toDate() : new Date(),
          updatedAt: group.updatedAt?.toDate ? group.updatedAt.toDate() : new Date()
        }));

        // Update department stats with actual group count
        this.departmentStats = {
          ...this.departmentStats,
          groups: this.groups.length
        };

        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading department groups:', error);
        this.presentToast('Error loading groups: ' + (error.message || 'Unknown error'));

        // Initialize with fallback data on error
        this.groups = [
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
          }
        ];
        
        this.departmentStats = {
          ...this.departmentStats,
          groups: this.groups.length
        };
      }
    });
  }

  // Load recent sessions from database
  loadRecentSessions() {
    console.log('Loading recent sessions...');
    
    // Get current timetable sessions and use the most recent ones
    this.timetableService.sessions$.subscribe({
      next: (sessions) => {
        console.log('Recent sessions loaded from timetable:', sessions.length);
        
        // Take the last 3 sessions as "recent" (or all if less than 3)
        const recentSessions = sessions.slice(-3);

        // Map to the format expected by the UI
        this.recentSessions = recentSessions.map((session, index) => ({
          id: session.id,
          moduleName: session.moduleName,
          moduleId: session.moduleId,
          day: session.day,
          timeSlot: session.timeSlot,
          venue: session.venue,
          lecturer: session.lecturer,
          group: session.group,
          scheduledAt: new Date(Date.now() - (index * 3600000)) // Simulate different times
        }));

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading recent sessions:', error);
        this.presentToast('Error loading recent sessions: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // Load submission status from database
  loadSubmissionStatusFromDatabase() {
    if (!this.departmentInfo.name || this.departmentInfo.name === 'Loading...') {
      console.log('Department not loaded yet, waiting...');
      return;
    }

    console.log('Loading submission status from database for:', this.departmentInfo.name);
    
    // Get current timetable for this department
    this.timetableDatabaseService.getCurrentTimetable(this.departmentInfo.name).subscribe({
      next: (timetable) => {
        if (timetable) {
          console.log('Current timetable status:', timetable.status);
          
          // Update submission status based on timetable status
          this.updateSubmissionStatusFromTimetable(timetable);
        } else {
          console.log('No current timetable found');
          
          // Set default draft status
          this.submissionStatus = {
            status: 'draft',
            label: 'Draft',
            message: 'Start building your timetable by adding sessions.',
            canEdit: true,
            buttonText: 'Add Sessions'
          };
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading submission status:', error);
        this.presentToast('Error loading submission status: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // Helper method to convert day number to day name
  getDayName(dayNumber: number): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
  }

  // Helper method to update submission status from timetable
  updateSubmissionStatusFromTimetable(timetable: any) {
    const currentDate = new Date();
    
    switch (timetable.status) {
      case 'draft':
        this.submissionStatus = {
          status: 'draft',
          label: 'Draft',
          message: 'Continue building your timetable.',
          canEdit: true,
          buttonText: 'Edit Timetable'
        };
        break;
      case 'submitted':
        this.submissionStatus = {
          status: 'submitted',
          label: 'Submitted',
          message: 'Your timetable has been submitted for review.',
          canEdit: false,
          buttonText: 'View Timetable'
        };
        break;
      case 'approved':
        this.submissionStatus = {
          status: 'approved',
          label: 'Approved',
          message: 'Your timetable has been approved.',
          canEdit: false,
          buttonText: 'View Timetable'
        };
        break;
      case 'rejected':
        this.submissionStatus = {
          status: 'rejected',
          label: 'Rejected',
          message: timetable.adminFeedback || 'Your timetable needs revisions.',
          canEdit: true,
          buttonText: 'Edit Timetable'
        };
        break;
      default:
        this.submissionStatus = {
          status: 'in-progress',
          label: 'In Progress',
          message: 'Continue working on your timetable.',
          canEdit: true,
          buttonText: 'Edit Timetable'
        };
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
        departmentId: parseInt(this.departmentInfo.id) || 1,
        hasConflict: session.hasConflict
      } as TimetableSession;
    });
  }

  // View details of a session from submission timetable
  viewSubmissionSessionDetails(session: TimetableSession) {
    console.log('Viewing submission session details:', session);
    // Show details of the session, e.g., in a modal
  }

  // Auto-save functionality
  startAutoSave() {
    console.log('Starting auto-save functionality');
    
    // Save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.autoSaveTimetable();
    }, 30000);
  }

  stopAutoSave() {
    console.log('Stopping auto-save functionality');
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  autoSaveTimetable() {
    console.log('Auto-saving timetable...');
    
    // Only auto-save if there have been changes and it's been at least 10 seconds since last save
    if (this.lastSaveTime && (Date.now() - this.lastSaveTime.getTime()) < 10000) {
      return; // Skip if saved too recently
    }

    this.timetableService.autoSaveTimetable().subscribe({
      next: (result) => {
        if (result.success) {
          console.log('Auto-save successful');
          this.lastSaveTime = new Date();
        } else {
          console.warn('Auto-save failed:', result.message);
        }
      },
      error: (error) => {
        console.error('Auto-save error:', error);
      }
    });
  }

  // Manual save functionality
  saveTimetable() {
    console.log('Manually saving timetable...');
    
    this.timetableService.saveTimetableToDatabase().subscribe({
      next: (result) => {
        if (result.success) {
          this.presentToast('Timetable saved successfully');
          this.lastSaveTime = new Date();
        } else {
          this.presentToast('Failed to save timetable: ' + result.message);
        }
      },
      error: (error) => {
        console.error('Error saving timetable:', error);
        this.presentToast('Error saving timetable');
      }
    });
  }

  // Load submission history from database
  loadSubmissionHistoryFromDatabase() {
    if (!this.departmentInfo.name || this.departmentInfo.name === 'Loading...') {
      console.log('Department not loaded yet, skipping submission history load');
      return;
    }

    console.log('Loading submission history from database for:', this.departmentInfo.name);
    
    this.timetableDatabaseService.loadSubmissionHistory(this.departmentInfo.name).subscribe({
      next: (submissions) => {
        console.log('Submission history loaded from database:', submissions);
        
        // Transform database submissions to display format
        this.submissionHistory = submissions.map(submission => ({
          id: parseInt(submission.id) || 0,
          academicPeriod: submission.academicPeriod,
          submittedAt: submission.submittedAt?.toDate ? submission.submittedAt.toDate() : new Date(submission.submittedAt),
          status: submission.status,
          conflictCount: submission.conflictCount,
          hasAdminFeedback: submission.hasAdminFeedback,
          adminFeedback: submission.adminFeedback
        }));
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading submission history:', error);
        this.presentToast('Error loading submission history');
      }
    });
  }
}