import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession, SessionDropEvent, WeekChangeEvent } from '../components/timetable-grid/timetable-grid.component';
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
import { AddGroupComponent } from '../components/add-group/add-group.component';
import { AuthService } from '../services/Authentication Services/auth.service';
import { UserService, DepartmentInfo, DepartmentStats } from '../services/Authentication Services/user.service';
import { Firestore, collection, collectionData, doc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
// Import Firebase compat for accessing existing data
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
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
  timeSlots = ['07:45 - 08:25', '09:15 - 09:55', '10:15 - 10:55', '11:00 - 11:40',
    '11:45 - 12:25', '13:05 - 13:45', '13:50 - 14:30', '14:35 - 15:10', '15:15 - 16:00'];

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
  
  // Timetable view mode
  timetableViewMode: 'creation' | 'conflicts' = 'creation';

  // Add these properties
  // Department ID - will be set from current user's department
  departmentId: number = 0; // Make public for template access
  sessionToAdd: SessionForm | null = null;
  hasUnsavedChanges: boolean = false; // Track if there are unsaved changes
  
  // Enhanced drag and drop configuration
  dragDropConfig = {
    enableMagneticSnap: true,
    enableConflictPrevention: true,
    showDropPreview: true
  };
  
  // Academic Week Configuration - MUT Academic Calendar 2025
  academicWeekConfig = {
    academicStartWeek: 2, // University opens Monday, 06 January 2025 (Week 2)
    academicEndWeek: 50, // University closes Friday, 12 December 2025 (Week 50)
    currentWeek: 0, // Will be set in ngOnInit
    totalWeeks: 52, // Total weeks in the year
    semesterBreakWeeks: [14, 26, 27, 28], // March recess (Week 14), Mid-year break (Weeks 26-28)
    examWeeks: [21, 22, 23, 24, 25, 41, 42, 43, 45, 46, 47, 48, 49], // First semester exams (21-25), Annual exams (41-43), Second semester exams (45-49)
    customWeekLabels: new Map<number, string>() // Custom labels for specific weeks
  };
  
  // Week selection and display
  selectedWeek: number = 0; // Will be set in ngOnInit
  weekViewMode: 'current' | 'selected' | 'range' = 'current';
  
  private sessionsLoadedFromDatabase: boolean = false; // Track if sessions were loaded from database
  private venuesLoaded: boolean = false; // Track if venues are loaded
  private departmentLoaded: boolean = false; // Track if department info is loaded
  private isCreatingSession: boolean = false; // Track if we're in the middle of creating a session

  // Utility method to remove duplicate sessions based on ID
  private removeDuplicateSessions() {
    const uniqueSessions = this.timetableSessions.reduce((acc, session) => {
      if (!acc.some(s => s.id === session.id)) {
        acc.push(session);
      }
      return acc;
    }, [] as any[]);
    
    if (uniqueSessions.length !== this.timetableSessions.length) {
      console.warn(`Removed ${this.timetableSessions.length - uniqueSessions.length} duplicate sessions`);
      this.timetableSessions = uniqueSessions;
    }
  }

  // Academic Week Utility Methods
  getCurrentWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }

  getWeekStartDate(weekNumber: number, year: number = new Date().getFullYear()): Date {
    const firstDay = new Date(year, 0, 1);
    const daysToAdd = (weekNumber - 1) * 7;
    const weekStart = new Date(firstDay.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday (start of week)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    return weekStart;
  }

  getWeekEndDate(weekNumber: number, year: number = new Date().getFullYear()): Date {
    const weekStart = this.getWeekStartDate(weekNumber, year);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Friday (end of academic week)
    return weekEnd;
  }

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
    private firestore: Firestore // Add Firestore directly to load groups
  ) {
    console.log('HodDashPage constructor');
  }

  ngOnInit() {
    console.log('HodDashPage ngOnInit');

    // Initialize academic week configuration
    this.academicWeekConfig.currentWeek = this.getCurrentWeekNumber();
    this.selectedWeek = this.academicWeekConfig.currentWeek;

    // Add beforeunload listener to warn about unsaved changes
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

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
    this.loadTimetableSessionsFromDatabase();

    // Debug: Check what collections exist in Firestore
    this.debugFirestoreCollections();
  }

  // Debug method to check Firestore collections
  debugFirestoreCollections() {
    console.log('=== DEBUGGING FIRESTORE COLLECTIONS ===');
    
    // Check staff collection for the current department
    const currentDept = this.departmentInfo.name !== 'Loading...' ? this.departmentInfo.name : 'INFO & COMMS TECHNOLOGY';
    
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      // Check staff collection
      firestore.collection('staff').doc(currentDept).get()
        .then((doc) => {
          if (doc.exists) {
            const data = doc.data();
            console.log('Found staff document for department:', currentDept);
            console.log('Staff document data:', data);
            console.log('Lecturers array length:', data?.['lecturers']?.length || 0);
            if (data?.['lecturers'] && data['lecturers'].length > 0) {
              console.log('Sample lecturer:', data['lecturers'][0]);
            }
          } else {
            console.log('No staff document found for department:', currentDept);
          }
        })
        .catch((error) => {
          console.log('Error accessing staff collection:', error);
        });

      // Check module collection
      firestore.collection('module').doc(currentDept).get()
        .then((doc) => {
          if (doc.exists) {
            const data = doc.data();
            console.log('Found module document for department:', currentDept);
            console.log('Module document data:', data);
            console.log('Modules array length:', data?.['modules']?.length || 0);
            if (data?.['modules'] && data['modules'].length > 0) {
              console.log('Sample module:', data['modules'][0]);
            }
          } else {
            console.log('No module document found for department:', currentDept);
          }
        })
        .catch((error) => {
          console.log('Error accessing module collection:', error);
        });

      // Check timetables collection
      firestore.collection('timetables')
        .where('department', '==', currentDept)
        .get()
        .then((querySnapshot) => {
          console.log('Found timetables for department:', currentDept, 'Count:', querySnapshot.size);
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Timetable document:', doc.id, data);
            console.log('Sessions array length:', data?.['sessions']?.length || 0);
          });
        })
        .catch((error) => {
          console.log('Error accessing timetables collection:', error);
        });
        
    } catch (error) {
      console.log('Firebase app not available for debugging:', error);
    }

    console.log('=== END FIRESTORE DEBUG ===');
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
          
          // Set departmentId using a hash-based approach since the ID is the department name
          this.departmentId = this.getDepartmentIdFromName(departmentName);
          this.departmentLoaded = true;
          
          console.log('Department loaded, ID set to:', this.departmentId);
          
          this.cdr.detectChanges();
          
          // Load submission history after department is loaded
          this.loadSubmissionHistoryFromDatabase();
          
          // Load timetable sessions after department is loaded
          this.loadTimetableSessionsFromDatabase();
          
          // Check if we can initialize timetable now
          this.checkAndInitializeTimetable();
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
    
    // Set a proper department ID using hash-based approach
    this.departmentId = this.getDepartmentIdFromName(departmentName || 'unknown');
    this.departmentLoaded = true;
    
    console.log('Fallback department loaded, ID set to:', this.departmentId);
    
    this.cdr.detectChanges();
    
    // Check if we can initialize timetable now
    this.checkAndInitializeTimetable();
  }

  // Generate a consistent numeric ID from department name
  private getDepartmentIdFromName(departmentName: string): number {
    // Create a simple hash function to generate consistent numeric IDs
    let hash = 0;
    for (let i = 0; i < departmentName.length; i++) {
      const char = departmentName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Ensure positive number and within reasonable range
    return Math.abs(hash % 10000) + 1;
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
        this.venuesLoaded = true;

        // Check if we can initialize timetable now
        this.checkAndInitializeTimetable();
      },
      error: (error) => {
        console.error('HOD: Error in initial venue load:', error);
        this.venuesLoading = false;
        this.createMockVenues(); // Fallback to mock data
        this.venuesLoaded = true;
        this.checkAndInitializeTimetable();
      }
    });
  }

  // Separate method to initialize timetable
  private initializeTimetable() {
    console.log('HOD: Initializing timetable...');

    // Initialize the current timetable
    this.timetableService.getCurrentTimetable(this.departmentId).subscribe(timetable => {
      if (timetable) {
        console.log('Current timetable loaded from service:', timetable);
        // Only format if we don't already have sessions loaded from database
        if (this.timetableSessions.length === 0) {
          this.formatTimetableSessions();
        }
      }
    });

    // Subscribe to session changes from service
    this.timetableService.sessions$.subscribe(sessions => {
      // Skip service updates when we're manually managing sessions (adding/editing)
      // or when we already have database-loaded sessions with correct positions
      // or when we're in the middle of creating a session
      if (!this.sessionsLoadedFromDatabase && !this.hasUnsavedChanges && !this.isCreatingSession) {
        console.log('Updating sessions from service:', sessions.length);
        
        const mappedSessions = sessions.map(session => ({
          id: session.id,
          moduleId: session.moduleId,
          moduleName: session.moduleName,
          day: session.day, // Preserve day from service
          timeSlot: session.timeSlot, // Preserve timeSlot from service
          venueId: session.venueId,
          venue: session.venue,
          lecturerId: session.lecturerId,
          lecturer: session.lecturer,
          groupId: session.groupId,
          group: session.group,
          hasConflict: session.hasConflict || false
        }));
        
        // Only update if there are actual differences
        if (JSON.stringify(mappedSessions) !== JSON.stringify(this.timetableSessions)) {
          this.timetableSessions = mappedSessions;
          this.formatTimetableSessions();
          this.detectTimetableConflicts();
        }
      } else {
        console.log('Skipping service update - preserving manually managed sessions');
      }
    });
  }

  // Check if both venues and department are loaded, then initialize timetable
  private checkAndInitializeTimetable() {
    console.log('Checking initialization readiness - venues:', this.venuesLoaded, 'department:', this.departmentLoaded);
    
    if (this.venuesLoaded && this.departmentLoaded && this.departmentId > 0) {
      console.log('Both venues and department loaded, initializing timetable with department ID:', this.departmentId);
      this.initializeTimetable();
    } else {
      console.log('Not ready yet - waiting for both venues and department to load');
    }
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

    // Remove beforeunload listener
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // Handle browser beforeunload event to warn about unsaved changes
  private handleBeforeUnload(event: BeforeUnloadEvent): string | undefined {
    if (this.hasUnsavedChanges) {
      // Standard way to trigger the browser's "leave page?" dialog
      const message = 'You have unsaved changes. Are you sure you want to leave?';
      event.preventDefault();
      event.returnValue = message; // Required for Chrome
      return message; // Required for other browsers
    }
    return undefined;
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
  async changeSection(section: string) {
    // Check for unsaved changes before navigation
    if (this.hasUnsavedChanges && this.activeSection !== section) {
      const shouldSave = await this.promptToSaveChanges();
      if (shouldSave === 'cancel') {
        return; // Cancel navigation
      } else if (shouldSave === 'save') {
        await this.saveTimetableChanges();
      } else {
        // User chose 'discard', so reset unsaved changes flag
        this.hasUnsavedChanges = false;
      }
    }

    this.activeSection = section;
    
    // Reset timetable view mode when entering timetable section
    if (section === 'timetable') {
      this.timetableViewMode = 'creation';
    }
    
    // Refresh submission data when entering submissions section
    if (section === 'submissions') {
      console.log('Entering submissions section, refreshing status and history');
      this.loadSubmissionStatusFromDatabase();
      this.loadSubmissionHistoryFromDatabase();
    }
  }
  
  // Toggle timetable view mode
  changeTimetableViewMode(mode: 'creation' | 'conflicts') {
    this.timetableViewMode = mode;
    
    // Update conflict resolver state for backward compatibility
    this.showConflictResolver = (mode === 'conflicts');
    
    // Detect conflicts when switching to conflicts view
    if (mode === 'conflicts') {
      this.detectTimetableConflicts();
    }
    
    console.log('Timetable view mode changed to:', mode);
  }

  // Handle segment change event with proper type checking
  onTimetableViewModeChange(event: any) {
    const value = event.detail?.value;
    if (value === 'creation' || value === 'conflicts') {
      this.changeTimetableViewMode(value);
    }
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
    // Only set default values if not already set (e.g., when called from general add button)
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
        timeSlot: '07:45 - 08:25', // Use valid time slot format
        departmentId: this.departmentId,
        category: 'Lecture',
        notes: ''
      };
    }

    // Open venue selection modal
    this.openVenueAvailability();
  }

  addSessionAt(day: string, timeSlot: string) {
    console.log(`Adding session at ${day}, ${timeSlot}`);
    
    // Initialize session with the specific day and time slot
    this.sessionToAdd = {
      moduleId: 0,
      moduleName: '',
      lecturerId: 0,
      lecturer: '',
      venueId: '',
      venue: '',
      groupId: 0,
      group: '',
      day: day,
      timeSlot: timeSlot,
      departmentId: this.departmentId,
      category: 'Lecture',
      notes: ''
    };

    // Open venue selection modal for this specific time slot
    this.openVenueAvailability();
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
        timeSlot: '07:45 - 08:25', // Use valid time slot format
        departmentId: this.departmentId,
        category: 'Lecture',
        notes: ''
      };
    }

    // Update the venue information
    this.sessionToAdd.venueId = event.venue.id;
    this.sessionToAdd.venue = event.venue.name;

    // If slots are provided, update the session time (this will override any pre-set time)
    if (event.startSlot !== undefined && event.endSlot !== undefined) {
      // Convert slot numbers to time string
      this.sessionToAdd.timeSlot = this.sessionService.formatTimeSlot(event.startSlot, event.endSlot);

      // Update day based on the selected date
      const dayOfWeek = event.date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        this.sessionToAdd.day = this.weekDays[dayOfWeek - 1]; // Adjust for zero-based array
      }
    }
    // If no slots provided, keep the existing day and timeSlot from addSessionAt

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
                
                // Auto-assign lecturer based on module assignment
                this.autoAssignLecturerForModule(selectedModule);
              }
            }
          }
        }
      ]
    });

    await moduleSelect.present();
  }

  // Auto-assign lecturer for module based on module assignment
  autoAssignLecturerForModule(selectedModule: any) {
    if (!selectedModule.lecturerIds || selectedModule.lecturerIds.length === 0) {
      // No lecturers assigned to this module, show manual selection
      console.log('No lecturers assigned to module:', selectedModule.name);
      this.selectLecturerForSession();
      return;
    }

    // Filter lecturers who are assigned to this module
    const assignedLecturers = this.lecturers.filter(lecturer => 
      selectedModule.lecturerIds.includes(lecturer.id)
    );

    if (assignedLecturers.length === 0) {
      // Module has lecturer IDs but none found in current lecturer list
      console.log('Assigned lecturers not found in current lecturer list for module:', selectedModule.name);
      this.selectLecturerForSession();
      return;
    }

    if (assignedLecturers.length === 1) {
      // Only one lecturer assigned, auto-select them
      const assignedLecturer = assignedLecturers[0];
      this.sessionToAdd!.lecturerId = assignedLecturer.id;
      this.sessionToAdd!.lecturer = assignedLecturer.name;
      
      console.log(`Auto-assigned lecturer ${assignedLecturer.name} to module ${selectedModule.name}`);
      
      // Show confirmation and proceed to group selection
      this.presentToast(`Auto-assigned lecturer: ${assignedLecturer.name}`);
      this.selectGroupForSession();
    } else {
      // Multiple lecturers assigned, let user choose from assigned ones
      console.log(`Multiple lecturers assigned to module ${selectedModule.name}, showing selection`);
      this.selectLecturerForSessionFromAssigned(assignedLecturers);
    }
  }

  // Select lecturer for the session from pre-assigned lecturers
  async selectLecturerForSessionFromAssigned(assignedLecturers: any[]) {
    const lecturerSelect = await this.alertController.create({
      header: 'Select Assigned Lecturer',
      message: `Choose from lecturers assigned to this module:`,
      inputs: assignedLecturers.map(lecturer => ({
        name: `lecturer-${lecturer.id}`,
        type: 'radio',
        label: `${lecturer.name} (Assigned)`,
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
          text: 'Choose Different',
          handler: () => {
            // Allow manual selection from all lecturers
            this.selectLecturerForSession();
          }
        },
        {
          text: 'Select',
          handler: (lecturerId) => {
            if (this.sessionToAdd && lecturerId) {
              const selectedLecturer = assignedLecturers.find(l => l.id === lecturerId);
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

    // Get the current module to show which lecturers are assigned
    const currentModule = this.sessionToAdd ? this.modules.find(m => m.id === this.sessionToAdd!.moduleId) : null;
    const assignedLecturerIds = currentModule?.lecturerIds || [];

    const lecturerSelect = await this.alertController.create({
      header: 'Select Lecturer',
      message: currentModule ? `For module: ${currentModule.name}` : 'Choose a lecturer for this session',
      inputs: this.lecturers.map(lecturer => ({
        name: `lecturer-${lecturer.id}`,
        type: 'radio',
        label: assignedLecturerIds.includes(lecturer.id) 
          ? `${lecturer.name} ✓ (Assigned to module)` 
          : lecturer.name,
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
                
                // Show warning if lecturer is not assigned to the module
                if (currentModule && !assignedLecturerIds.includes(lecturerId)) {
                  this.presentToast(`Warning: ${selectedLecturer.name} is not assigned to ${currentModule.name}`, 'warning');
                }
                
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

    // Set flag to prevent service subscription interference
    this.isCreatingSession = true;

    // Store position data before creating session to prevent loss
    const preservedDay = this.sessionToAdd.day;
    const preservedTimeSlot = this.sessionToAdd.timeSlot;
    
    console.log('Creating session with preserved position:', {
      day: preservedDay,
      timeSlot: preservedTimeSlot
    });

    this.sessionService.createSession(this.sessionToAdd).subscribe(
      (newSession) => {
        console.log('Session created:', newSession);

        // Check if session already exists to prevent duplicates
        const existingSessionIndex = this.timetableSessions.findIndex(s => s.id === newSession.id);
        if (existingSessionIndex !== -1) {
          console.warn('Session already exists, updating instead of adding');
          this.timetableSessions[existingSessionIndex] = {
            ...this.timetableSessions[existingSessionIndex],
            ...newSession,
            day: preservedDay || 'Monday',
            timeSlot: preservedTimeSlot || '07:45 - 08:25'
          };
        } else {
          // Add the new session to the local timetable sessions with preserved position
          const mappedSession = {
            id: newSession.id,
            moduleId: newSession.moduleId,
            moduleName: newSession.moduleName,
            day: preservedDay || 'Monday', // Use preserved position data
            timeSlot: preservedTimeSlot || '07:45 - 08:25', // Use preserved position data
            venueId: newSession.venueId,
            venue: newSession.venue,
            lecturerId: newSession.lecturerId,
            lecturer: newSession.lecturer,
            groupId: newSession.groupId,
            group: newSession.group,
            hasConflict: false
          };
          
          // Add to local sessions
          this.timetableSessions.push(mappedSession);
          console.log('Added new session at', mappedSession.day, mappedSession.timeSlot);
        }
        
        // Clear formatted sessions to force fresh formatting
        this.formattedTimetableSessions = [];
        
        // Re-format sessions for the grid
        this.formatTimetableSessions();
        
        // Force change detection to ensure UI updates
        this.cdr.detectChanges();

        // Mark that there are unsaved changes
        this.hasUnsavedChanges = true;
        
        // Clear the session creation flag
        this.isCreatingSession = false;

        // Show success message
        this.alertController.create({
          header: 'Success',
          message: 'Session has been added to the timetable. Remember to save your changes.',
          buttons: ['OK']
        }).then(alert => alert.present());

        // Reset session to add
        this.sessionToAdd = null;
      },
      (error) => {
        console.error('Error creating session:', error);
        
        // Clear the session creation flag even on error
        this.isCreatingSession = false;

        // Show error message
        this.alertController.create({
          header: 'Error',
          message: 'Failed to create session. Please try again.',
          buttons: ['OK']
        }).then(alert => alert.present());
      }
    );
  }

  // Enhanced method to submit timetable to database
  async submitTimetable() {
    try {
      console.log('Starting timetable submission process...');

      // Check for conflicts before submission
      this.detectTimetableConflicts();

      if (this.departmentConflicts.length > 0) {
        this.showConflictResolver = true;
        console.log('Cannot submit timetable with conflicts. Please resolve them first.');
        
        await this.alertController.create({
          header: 'Conflicts Detected',
          message: `Your timetable has ${this.departmentConflicts.length} conflict(s). Please resolve them before submitting.`,
          buttons: ['OK']
        }).then(alert => alert.present());
        
        return;
      }

      // Check if user has department info
      if (!this.departmentInfo.name || this.departmentInfo.name === 'Loading...') {
        console.error('Department information not available');
        await this.alertController.create({
          header: 'Error',
          message: 'Department information not available. Please refresh the page.',
          buttons: ['OK']
        }).then(alert => alert.present());
        return;
      }

      // Show loading message
      const loadingAlert = await this.alertController.create({
        header: 'Submitting...',
        message: 'Please wait while your timetable is being submitted.',
        backdropDismiss: false
      });
      await loadingAlert.present();

      console.log('Submitting timetable for department:', this.departmentInfo.name);

      // First, save the current timetable to database using department info we have
      // Instead of using timetableService.saveTimetableToDatabase(), we'll create/save directly
      let currentTimetableDoc = await this.timetableDatabaseService.getCurrentTimetable(this.departmentInfo.name).toPromise();
      
      if (!currentTimetableDoc) {
        // Create new timetable directly with the department we have
        const createResult = await this.timetableDatabaseService.createNewTimetable(
          this.departmentInfo.name,
          `${new Date().getFullYear()} Timetable`,
          `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          1
        ).toPromise();
        
        if (!createResult || !createResult.success) {
          throw new Error(createResult?.message || 'Failed to create timetable');
        }
        
        // Get the newly created timetable
        currentTimetableDoc = await this.timetableDatabaseService.getCurrentTimetable(this.departmentInfo.name).toPromise();
        
        if (!currentTimetableDoc) {
          throw new Error('Failed to retrieve newly created timetable');
        }
        
        console.log('New timetable created:', currentTimetableDoc.id);
      }

      // Update the timetable with current sessions before submission
      if (this.timetableSessions && this.timetableSessions.length > 0) {
        const timetableSessions = this.timetableSessions.map(session => {
          const sessionData: any = {
            id: session.id,
            moduleId: session.moduleId,
            moduleName: session.moduleName,
            lecturerId: session.lecturerId,
            lecturer: session.lecturer,
            venueId: session.venueId || session.venue, // Handle both cases
            venue: session.venue,
            groupId: session.groupId,
            group: session.group,
            day: session.day,
            timeSlot: session.timeSlot,
            category: (session as any).category || 'Lecture',
            color: (session as any).color || '#007bff',
            departmentId: (session as any).departmentId || 1,
            hasConflict: session.hasConflict || false
          };

          // Only add optional fields if they have values
          if ((session as any).startTime) {
            sessionData.startTime = (session as any).startTime;
          }
          if ((session as any).endTime) {
            sessionData.endTime = (session as any).endTime;
          }
          if ((session as any).notes) {
            sessionData.notes = (session as any).notes;
          }

          return sessionData;
        });

        const updateResult = await this.timetableDatabaseService.saveTimetable({
          sessions: timetableSessions,
          status: 'draft'
        }, currentTimetableDoc.id).toPromise();

        if (!updateResult || !updateResult.success) {
          throw new Error(updateResult?.message || 'Failed to save timetable sessions');
        }
        
        console.log('Timetable sessions updated successfully');
      }

      console.log('Submitting timetable ID:', currentTimetableDoc.id);

      // Submit the timetable using database service
      const submissionResult = await this.timetableDatabaseService.submitTimetable(currentTimetableDoc.id).toPromise();

      await loadingAlert.dismiss();

      if (submissionResult && submissionResult.success) {
        console.log('Timetable submitted successfully:', submissionResult);

        // Update local submission status
        this.submissionStatus = {
          status: 'submitted',
          label: 'Submitted',
          message: 'Your timetable has been submitted for approval.',
          canEdit: false,
          buttonText: 'View Timetable'
        };

        // Reload submission history to show the new submission
        this.loadSubmissionHistoryFromDatabase();

        // Show success message
        await this.alertController.create({
          header: 'Success',
          message: 'Your timetable has been successfully submitted for approval!',
          buttons: ['OK']
        }).then(alert => alert.present());

        // Show success toast
        await this.presentToast('Timetable submitted successfully!');

        // Switch to submissions view to show the new submission
        this.changeSection('submissions');

      } else {
        throw new Error(submissionResult?.message || 'Unknown submission error');
      }

    } catch (error: any) {
      console.error('Error during timetable submission:', error);

      // Dismiss loading if still present
      try {
        await this.alertController.getTop().then(alert => {
          if (alert && alert.tagName === 'ION-ALERT') {
            alert.dismiss();
          }
        });
      } catch (dismissError) {
        console.log('No alert to dismiss');
      }

      // Show error message
      await this.alertController.create({
        header: 'Submission Failed',
        message: `Failed to submit timetable: ${error?.message || 'Unknown error'}. Please try again.`,
        buttons: ['OK']
      }).then(alert => alert.present());

      // Show error toast
      await this.presentToast('Submission failed. Please try again.');
    }
  }

  // Format the existing timetable sessions for the timetable grid component
  formatTimetableSessions() {
    // Remove duplicates first
    this.removeDuplicateSessions();
    
    console.log('Formatting', this.timetableSessions.length, 'sessions for grid display');
    
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

      // University time slots mapping
      const timeSlotMap: { [key: string]: number } = {
        '07:45 - 08:25': 0,
        '09:15 - 09:55': 1,
        '10:15 - 10:55': 2,
        '11:00 - 11:40': 3,
        '11:45 - 12:25': 4,
        '13:05 - 13:45': 5,
        '13:50 - 14:30': 6,
        '14:35 - 15:10': 7,
        '15:15 - 16:00': 8
      };

      // Get slot number from time slot string, default to 0 if not found
      const slotNumber = timeSlotMap[session.timeSlot] ?? 0;
      
      // Ensure day is valid, default to Monday (0) if invalid
      const dayNumber = dayMap[session.day] ?? 0;
      
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
        day: dayNumber,
        startSlot: slotNumber,
        endSlot: slotNumber + 1, // Most sessions are single slot
        category: this.getModuleCategory(session.moduleId),
        color: moduleColor,
        departmentId: parseInt(this.departmentInfo.id) || 1,
        hasConflict: session.hasConflict
      } as TimetableSession;
    });
    
    console.log('Formatted sessions:', this.formattedTimetableSessions.length);
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

  // Handle session drop from timetable grid with enhanced functionality
  handleSessionDrop(event: SessionDropEvent) {
    console.log('Enhanced session dropped:', event);

    // Map day number back to string
    const dayMap = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const newDay = dayMap[event.day];
    const previousDay = event.previousDay !== undefined ? dayMap[event.previousDay] : '';

    // University time slots mapping (reverse lookup)
    const timeSlots = [
      '07:45 - 08:25',  // slot 0
      '09:15 - 09:55',  // slot 1
      '10:15 - 10:55',  // slot 2
      '11:00 - 11:40',  // slot 3
      '11:45 - 12:25',  // slot 4
      '13:05 - 13:45',  // slot 5
      '13:50 - 14:30',  // slot 6
      '14:35 - 15:10',  // slot 7
      '15:15 - 16:00'   // slot 8
    ];

    const newTimeSlot = timeSlots[event.startSlot] || timeSlots[0];
    const previousTimeSlot = event.previousSlot !== undefined ? 
                           timeSlots[event.previousSlot] || '' : '';

    // Find and update the session
    const sessionIndex = this.timetableSessions.findIndex(s => s.id === event.session.id);
    if (sessionIndex !== -1) {
      const originalSession = { ...this.timetableSessions[sessionIndex] };
      
      this.timetableSessions[sessionIndex] = {
        ...this.timetableSessions[sessionIndex],
        day: newDay,
        timeSlot: newTimeSlot
      };

      // Mark as having unsaved changes
      this.hasUnsavedChanges = true;
      
      // Clear formatted sessions to force re-format
      this.formattedTimetableSessions = [];
      
      // Re-format sessions for the grid
      this.formatTimetableSessions();
      
      // Force change detection
      this.cdr.detectChanges();
      
      // Enhanced success message with more details
      let message = `Session "${event.session.title}" moved to ${newDay} at ${newTimeSlot}`;
      
      if (event.isSnapped) {
        message += ' (snapped to nearby session)';
      }
      
      if (previousDay && previousTimeSlot) {
        message += `. Previous location: ${previousDay} at ${previousTimeSlot}`;
      }
      
      message += '. Remember to save your changes.';
      
      this.presentToast(message);
      
      // Log the move for potential undo functionality
      this.logSessionMove(originalSession, this.timetableSessions[sessionIndex], event.isSnapped);
    }
  }

  // Log session moves for potential undo functionality
  private logSessionMove(originalSession: any, newSession: any, wasSnapped?: boolean) {
    const moveLog = {
      sessionId: originalSession.id,
      sessionTitle: originalSession.moduleName,
      originalDay: originalSession.day,
      originalTimeSlot: originalSession.timeSlot,
      newDay: newSession.day,
      newTimeSlot: newSession.timeSlot,
      timestamp: new Date(),
      wasSnapped: wasSnapped || false
    };
    
    console.log('Session move logged:', moveLog);
    // This could be expanded to maintain a history for undo functionality
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
          
          // Mark as having unsaved changes
          this.hasUnsavedChanges = true;
          
          // Re-format sessions for the grid
          this.formatTimetableSessions();
          
          // Show success message
          this.presentToast(`Session "${session.title}" deleted successfully. Remember to save your changes.`);
          
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

  // Handle week change from timetable grid
  handleWeekChange(event: WeekChangeEvent) {
    console.log('Week changed:', event);
    this.selectedWeek = event.weekNumber;
    // Optionally filter sessions or perform other actions based on week change
  }

  // New method to get lecturer names from IDs
  getLecturerNames(lecturerIds: number[]): string[] {
    if (!lecturerIds || lecturerIds.length === 0) {
      return ['No lecturers assigned'];
    }
    
    const assignedLecturers = this.lecturers
      .filter(lecturer => lecturerIds.includes(lecturer.id))
      .map(lecturer => lecturer.name);
    
    return assignedLecturers.length > 0 ? assignedLecturers : ['Assigned lecturers not found'];
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

  async addGroup() {
    console.log('Adding new group');
    try {
      const modal = await this.modalController.create({
        component: AddGroupComponent,
        componentProps: {
          currentUserRole: 'HOD',
          departmentName: this.departmentInfo.name
        },
        cssClass: 'group-modal'
      });

      await modal.present();

      const { data } = await modal.onDidDismiss();

      if (data) {
        this.handleNewGroupCreation(data);
      }
    } catch (error) {
      console.error('Error opening add group modal:', error);
      // Fallback to navigation if modal fails
      this.router.navigate(['/hod-dash/add-group']);
    }
  }

  async editGroup(group: Group) {
    console.log('Editing group:', group);
    try {
      const modal = await this.modalController.create({
        component: AddGroupComponent,
        componentProps: {
          group: group,
          currentUserRole: 'HOD',
          departmentName: this.departmentInfo.name
        },
        cssClass: 'group-modal'
      });

      await modal.present();

      const { data } = await modal.onDidDismiss();

      if (data) {
        this.handleGroupUpdate(data);
      }
    } catch (error) {
      console.error('Error opening edit group modal:', error);
      this.presentToast('Error opening edit dialog');
    }
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

  async deleteGroup(group: Group) {
    console.log('Deleting group:', group);
    
    // Show confirmation dialog
    const alert = await this.alertController.create({
      header: 'Delete Group',
      message: `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: async () => {
            try {
              // Use Firestore directly to delete the group
              const groupDocRef = doc(this.firestore, 'groups', group.id.toString());
              await deleteDoc(groupDocRef);
              this.presentToast('Group deleted successfully');
              
              // Refresh the groups list
              this.loadDepartmentGroups();
              
              // Update department stats
              this.departmentStats = {
                ...this.departmentStats,
                groups: Math.max(0, this.departmentStats.groups - 1)
              };
            } catch (error: any) {
              console.error('Error deleting group:', error);
              this.presentToast('Error deleting group: ' + (error.message || 'Unknown error'));
            }
          }
        }
      ]
    });

    await alert.present();
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

  private handleNewGroupCreation(groupData: Group) {
    console.log('Creating new group:', groupData);
    
    // The group will be automatically saved to Firestore by the AddGroupComponent
    // We just need to refresh the local groups list and show success message
    this.presentToast('Group added successfully');
    
    // Refresh the groups list to include the new group
    this.loadDepartmentGroups();
    
    // Update department stats
    this.departmentStats = {
      ...this.departmentStats,
      groups: this.departmentStats.groups + 1
    };
  }

  private handleGroupUpdate(groupData: Group) {
    console.log('Updating group:', groupData);
    
    // The group will be automatically updated in Firestore by the AddGroupComponent
    // We just need to refresh the local groups list and show success message
    this.presentToast('Group updated successfully');
    
    // Refresh the groups list to show the updated group
    this.loadDepartmentGroups();
  }

    loadDepartmentModules() {
      this.moduleService.getDepartmentModules().subscribe({
        next: (modules) => {
          console.log('Department modules loaded:', modules);
          // Attach module.id as firebaseId for update
          this.modules = modules.map(module => ({
            ...module,
            firebaseId: module.id // Use module.id as Firestore doc ID
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
    this.showModuleAssignmentModal(module);
  }

  // Show module assignment modal for managing lecturer assignments
  async showModuleAssignmentModal(module: any) {
    const assignedLecturerIds = module.lecturerIds || [];
    
    const assignmentModal = await this.alertController.create({
      header: `Module Assignment: ${module.name}`,
      message: 'Select lecturers to assign to this module:',
      inputs: this.lecturers.map(lecturer => ({
        name: `lecturer-${lecturer.id}`,
        type: 'checkbox',
        label: lecturer.name,
        value: lecturer.id,
        checked: assignedLecturerIds.includes(lecturer.id)
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save Assignment',
          handler: (selectedLecturerIds: number[]) => {
            this.updateModuleLecturerAssignment(module, selectedLecturerIds);
          }
        }
      ]
    });

    await assignmentModal.present();
  }

  // Update module lecturer assignment
  private updateModuleLecturerAssignment(module: any, selectedLecturerIds: number[]) {
    console.log('Updating module lecturer assignment:', module.name, selectedLecturerIds);
    
    // Update the module locally first
    const moduleIndex = this.modules.findIndex(m => m.id === module.id);
    const originalModule = moduleIndex !== -1 ? { ...this.modules[moduleIndex] } : null;
    
    if (moduleIndex !== -1) {
      this.modules[moduleIndex].lecturerIds = selectedLecturerIds;
      this.modules[moduleIndex].lecturerCount = selectedLecturerIds.length;
    }

    // Update in Firebase directly (update module in department's modules array)
    this.updateModuleInFirebase(this.departmentInfo.name, {
      lecturerIds: selectedLecturerIds,
      lecturerCount: selectedLecturerIds.length,
      updatedAt: new Date()
    }, module.id).then(() => {
      const lecturerNames = this.lecturers
        .filter(l => selectedLecturerIds.includes(l.id))
        .map(l => l.name)
        .join(', ');
      this.presentToast(
        selectedLecturerIds.length > 0 
          ? `Module ${module.name} assigned to: ${lecturerNames}`
          : `All lecturers removed from module ${module.name}`
      );
    }).catch((error: any) => {
      console.error('Error updating module assignment in Firebase:', error);
      this.presentToast('Error updating module assignment: ' + (error.message || 'Unknown error'), 'danger');
      // Revert local changes on error
      if (moduleIndex !== -1 && originalModule) {
        this.modules[moduleIndex].lecturerIds = originalModule.lecturerIds || [];
        this.modules[moduleIndex].lecturerCount = (originalModule.lecturerIds || []).length;
      }
    });
  }

  // Update module in Firebase directly
  private async updateModuleInFirebase(departmentName: string, updateData: any, moduleId: number): Promise<void> {
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      const departmentDocRef = firestore.collection('module').doc(departmentName);

      // Get the department document
      const docSnap = await departmentDocRef.get();
      let modulesArray: any[] = [];
      if (!docSnap.exists) {
        // If the department document does not exist, create it with this module
        modulesArray = [{
          id: moduleId,
          ...updateData
        }];
        await departmentDocRef.set({ modules: modulesArray });
        console.log('Department document created and module added in Firebase');
        return;
      }

      const data = docSnap.data();
      if (!data) {
        throw new Error('Department data is undefined');
      }
      modulesArray = data['modules'] || [];
      const moduleIndex = modulesArray.findIndex((m: any) => m.id === moduleId);
      if (moduleIndex === -1) {
        // If module not found, add it
        modulesArray.push({
          id: moduleId,
          ...updateData
        });
      } else {
        // Update the module object in the array
        modulesArray[moduleIndex] = {
          ...modulesArray[moduleIndex],
          ...updateData
        };
      }

      // Write the updated array back
      await departmentDocRef.update({ modules: modulesArray });
      console.log('Module updated successfully in Firebase');
    } catch (error) {
      console.error('Error updating module in Firebase:', error);
      throw error;
    }
  }

  // Get assigned lecturer names for display
  getAssignedLecturerNames(module: any): string {
    if (!module.lecturerIds || module.lecturerIds.length === 0) {
      return 'No lecturers assigned';
    }
    
    const assignedLecturers = this.lecturers.filter(lecturer => 
      module.lecturerIds.includes(lecturer.id)
    );
    
    if (assignedLecturers.length === 0) {
      return 'Assigned lecturers not found';
    }
    
    return assignedLecturers.map(l => l.name).join(', ');
  }

  // Submission History
  getSubmissionIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'submitted':
      case 'pending': return 'time';
      default: return 'document-text';
    }
  }

  getSubmissionColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'submitted':
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
    // Use the new view mode system
    const newMode = this.timetableViewMode === 'creation' ? 'conflicts' : 'creation';
    this.changeTimetableViewMode(newMode);
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

  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }

  // Check if timetable can be submitted - using getter to improve performance
  get canSubmitCurrentTimetable(): boolean {
    // Check if there are any sessions
    if (!this.timetableSessions || this.timetableSessions.length === 0) {
      return false;
    }

    // Check if there are unresolved conflicts
    if (this.departmentConflicts && this.departmentConflicts.length > 0) {
      return false;
    }

    // Check if submission status allows editing (not already submitted/approved)
    if (this.submissionStatus?.status === 'submitted' || this.submissionStatus?.status === 'approved') {
      return false;
    }

    return true;
  }

  // Helper method to check submission status with logging (call this when needed for debugging)
  checkSubmissionStatus(): void {
    if (!this.timetableSessions || this.timetableSessions.length === 0) {
      console.log('Cannot submit: No sessions scheduled');
      return;
    }

    if (this.departmentConflicts && this.departmentConflicts.length > 0) {
      console.log('Cannot submit: Unresolved conflicts exist');
      return;
    }

    if (this.submissionStatus?.status === 'submitted') {
      console.log('Cannot submit: Already submitted');
      return;
    }

    if (this.submissionStatus?.status === 'approved') {
      console.log('Cannot submit: Already approved');
      return;
    }

    console.log('Can submit timetable');
  }

  // Method to refresh timetable submission status
  refreshSubmissionStatus() {
    console.log('Refreshing submission status...');
    this.loadSubmissionStatusFromDatabase();
    this.loadSubmissionHistoryFromDatabase();
  }

  async logout() {
    console.log('Logging out...');
    
    try {
      // Save any pending changes before logout
      if (this.hasUnsavedChanges) {
        await this.saveTimetableChanges();
      }
      
      // Clear user authentication
      await this.authService.logout();
      
      // Clear local data
      this.clearLocalData();
      
      // Navigate to login
      this.router.navigate(['/home'], { replaceUrl: true });
      
    } catch (error) {
      console.error('Error during logout:', error);
      // Force navigate to login even if logout fails
      this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  // Helper method to clear local data
  private clearLocalData() {
    // Reset user-specific data
    this.departmentInfo = {
      id: '',
      name: 'Loading...',
      hodName: 'Loading...',
      email: '',
      phone: '',
      location: ''
    };
    
    // Clear timetable data
    this.timetableSessions = [];
    this.formattedTimetableSessions = [];
    
    // Clear department data
    this.lecturers = [];
    this.groups = [];
    this.modules = [];
    
    // Reset flags
    this.hasUnsavedChanges = false;
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
    
    // Use Firestore v9+ API to load groups
    const groupsCollection = collection(this.firestore, 'groups');
    collectionData(groupsCollection, { idField: 'id' }).subscribe({
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
          size: group.size || 0, // Add default size
          groupType: group.groupType, // Include groupType
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
            size: 25,
            groupType: 'Annual',
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
            size: 30,
            groupType: 'Annual',
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
    
    // Get the current department name
    const currentDept = this.departmentInfo.name !== 'Loading...' ? this.departmentInfo.name : 'INFO & COMMS TECHNOLOGY';
    
    // Use Firebase compat API to access timetables collection
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      // Query timetables collection for current department
      firestore.collection('timetables')
        .where('department', '==', currentDept)
        .where('isCurrentVersion', '==', true)
        .limit(1)
        .get()
        .then((querySnapshot: any) => {
          if (!querySnapshot.empty) {
            const timetableDoc = querySnapshot.docs[0];
            const timetableData = timetableDoc.data();
            
            console.log('Found current timetable:', timetableData);
            console.log('Sessions in timetable:', timetableData['sessions']?.length || 0);
            
            if (timetableData['sessions'] && timetableData['sessions'].length > 0) {
              // Take the last 3 sessions as "recent" (or all if less than 3)
              const sessions = timetableData['sessions'];
              const recentSessions = sessions.slice(-3);

              // Map to the format expected by the UI
              this.recentSessions = recentSessions.map((session: any, index: number) => ({
                id: session.id || index + 1,
                moduleName: session.moduleName || session.module || 'Unknown Module',
                moduleId: session.moduleId || session.id || 0,
                day: session.day || 'Monday',
                timeSlot: session.timeSlot || session.time || '08:00 - 09:00',
                venue: session.venue || session.venueId || 'Unknown Venue',
                lecturer: session.lecturer || session.lecturerId || 'Unknown Lecturer',
                group: session.group || session.groupId || 'Unknown Group',
                scheduledAt: session.createdAt ? session.createdAt.toDate() : new Date(Date.now() - (index * 3600000))
              }));
              
              // Update department stats with session count
              this.departmentStats = {
                ...this.departmentStats,
                sessions: sessions.length
              };
              
              console.log('Recent sessions loaded:', this.recentSessions);
              this.cdr.detectChanges();
            } else {
              console.log('No sessions found in current timetable');
              this.recentSessions = [];
              this.departmentStats = {
                ...this.departmentStats,
                sessions: 0
              };
            }
          } else {
            console.log('No current timetable found for department:', currentDept);
            this.recentSessions = [];
            this.departmentStats = {
              ...this.departmentStats,
              sessions: 0
            };
          }
        })
        .catch((error: any) => {
          console.error('Error loading recent sessions:', error);
          this.presentToast('Error loading recent sessions: ' + (error.message || 'Unknown error'));
          this.recentSessions = [];
        });
    } catch (error) {
      console.log('Firebase app not available, using timetable service fallback:', error);
      
      // Fallback to using timetable service
      this.timetableService.sessions$.subscribe({
        next: (sessions) => {
          console.log('Recent sessions loaded from timetable service:', sessions.length);
          
          if (sessions.length > 0) {
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
              scheduledAt: new Date(Date.now() - (index * 3600000))
            }));
            
            this.departmentStats = {
              ...this.departmentStats,
              sessions: sessions.length
            };
          } else {
            this.recentSessions = [];
            this.departmentStats = {
              ...this.departmentStats,
              sessions: 0
            };
          }
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading recent sessions from timetable service:', error);
          this.presentToast('Error loading recent sessions: ' + (error.message || 'Unknown error'));
        }
      });
    }
  }

  // Load complete timetable sessions from database and preserve their positions
  loadTimetableSessionsFromDatabase() {
    console.log('Loading complete timetable sessions from database...');
    
    // Wait for department to be loaded
    if (this.departmentInfo.name === 'Loading...') {
      console.log('Department not loaded yet, will retry in 1 second');
      setTimeout(() => this.loadTimetableSessionsFromDatabase(), 1000);
      return;
    }
    
    const currentDept = this.departmentInfo.name;
    
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      // Query timetables collection for current department
      firestore.collection('timetables')
        .where('department', '==', currentDept)
        .where('isCurrentVersion', '==', true)
        .limit(1)
        .get()
        .then((querySnapshot: any) => {
          if (!querySnapshot.empty) {
            const timetableDoc = querySnapshot.docs[0];
            const timetableData = timetableDoc.data();
            
            console.log('Found current timetable for sessions:', timetableData);
            
            if (timetableData['sessions'] && timetableData['sessions'].length > 0) {
              // Map sessions while preserving their day and time slot positions
              this.timetableSessions = timetableData['sessions'].map((session: any) => ({
                id: session.id,
                moduleId: session.moduleId || 0,
                moduleName: session.moduleName || session.module || 'Unknown Module',
                day: session.day || 'Monday', // Preserve the original day
                timeSlot: session.timeSlot || '07:45 - 08:25', // Use first time slot as default instead of invalid time
                venueId: session.venueId || session.venue,
                venue: session.venue || 'Unknown Venue',
                lecturerId: session.lecturerId || 0,
                lecturer: session.lecturer || 'Unknown Lecturer',
                groupId: session.groupId || 0,
                group: session.group || 'Unknown Group',
                hasConflict: session.hasConflict || false
              }));
              
              console.log(`Loaded ${this.timetableSessions.length} sessions from database`);
              console.log('Sample session positions:', this.timetableSessions.slice(0, 3).map(s => `${s.day} at ${s.timeSlot}`));
              
              // Remove any duplicates that might exist in database
              this.removeDuplicateSessions();
              
              // Set flag to indicate sessions were loaded from database
              this.sessionsLoadedFromDatabase = true;
              
              // Format sessions for the grid display
              this.formatTimetableSessions();
              
              // Detect any conflicts
              this.detectTimetableConflicts();
              
              this.cdr.detectChanges();
            } else {
              console.log('No sessions found in current timetable');
              this.timetableSessions = [];
              this.formattedTimetableSessions = [];
            }
          } else {
            console.log('No current timetable found for department:', currentDept);
            console.log('Creating initial timetable for department...');
            
            // Create an initial empty timetable for the department
            this.createInitialTimetable(currentDept).then(() => {
              console.log('Initial timetable created successfully');
              this.timetableSessions = [];
              this.formattedTimetableSessions = [];
            }).catch((error: any) => {
              console.error('Error creating initial timetable:', error);
              this.timetableSessions = [];
              this.formattedTimetableSessions = [];
            });
          }
        })
        .catch((error: any) => {
          console.error('Error loading timetable sessions:', error);
          this.presentToast('Error loading timetable sessions: ' + (error.message || 'Unknown error'));
          
          // Fallback to empty sessions
          this.timetableSessions = [];
          this.formattedTimetableSessions = [];
        });
    } catch (error) {
      console.log('Firebase app not available, using timetable service fallback:', error);
      
      // Fallback to using existing timetable service subscription
      console.log('Using existing timetable service subscription for session loading');
    }
  }

  // Create an initial empty timetable for the department
  private async createInitialTimetable(departmentName: string): Promise<void> {
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      const initialTimetable = {
        department: departmentName,
        isCurrentVersion: true,
        status: 'draft',
        sessions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        comments: '',
        version: 1
      };
      
      await firestore.collection('timetables').add(initialTimetable);
      console.log('Initial timetable document created for department:', departmentName);
      
    } catch (error: any) {
      console.error('Error creating initial timetable:', error);
      throw error;
    }
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
      case 'pending':
        this.submissionStatus = {
          status: 'submitted',
          label: 'Under Review',
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
    console.log('Loading timetable for submission ID:', submissionId);
    
    // Find the submission in our history
    const submission = this.submissionHistory.find(s => s.id === submissionId);
    if (!submission) {
      console.log('Submission not found in history, using current sessions');
      this.useCurrentSessionsForSubmission(submissionId);
      return;
    }
    
    console.log('Found submission:', submission);
    
    if (!submission.timetableId) {
      console.log('No timetableId found for submission, using current sessions');
      this.useCurrentSessionsForSubmission(submissionId);
      return;
    }
    
    console.log('Loading timetable with ID:', submission.timetableId);
    
    // Load the actual timetable from database using the timetableId
    this.timetableDatabaseService.getTimetableById(submission.timetableId).subscribe({
      next: (timetable) => {
        console.log('Retrieved timetable from database:', timetable);
        
        if (timetable && timetable.sessions && timetable.sessions.length > 0) {
          console.log('Found', timetable.sessions.length, 'sessions in timetable');
          
          // Convert database sessions to grid format
          this.selectedSubmissionTimetable = timetable.sessions.map(session => {
            const dayMap: { [key: string]: number } = {
              'Monday': 0,
              'Tuesday': 1,
              'Wednesday': 2,
              'Thursday': 3,
              'Friday': 4,
              'Saturday': 5,
              'Sunday': 6
            };

            // University time slots mapping (same as used in formatTimetableSessions)
            const timeSlotMap: { [key: string]: number } = {
              '07:45 - 08:25': 0,
              '09:15 - 09:55': 1,
              '10:15 - 10:55': 2,
              '11:00 - 11:40': 3,
              '11:45 - 12:25': 4,
              '13:05 - 13:45': 5,
              '13:50 - 14:30': 6,
              '14:35 - 15:10': 7,
              '15:15 - 16:00': 8
            };

            // Get slot number from time slot string, default to 0 if not found
            const slotNumber = timeSlotMap[session.timeSlot] ?? 0;

            return {
              id: session.id,
              title: session.moduleName || 'Unknown Module',
              module: session.moduleName || 'Unknown Module',
              moduleCode: this.getModuleCode(session.moduleId),
              lecturer: session.lecturer || 'Unknown Lecturer',
              venue: session.venue || 'Unknown Venue',
              group: session.group || 'Unknown Group',
              day: dayMap[session.day] || 0,
              startSlot: slotNumber,
              endSlot: slotNumber + 1,  // Single slot sessions
              category: session.category || this.getModuleCategory(session.moduleId),
              color: session.hasConflict ? '#eb445a' : this.getModuleColor(session.moduleId),
              departmentId: parseInt(this.departmentInfo.id) || 1,
              hasConflict: session.hasConflict || false
            } as TimetableSession;
          });
          
          console.log('Converted', this.selectedSubmissionTimetable.length, 'submission timetable sessions:', this.selectedSubmissionTimetable);
        } else {
          console.log('No sessions found in timetable or timetable is empty');
          console.log('Timetable object:', timetable);
          this.useCurrentSessionsForSubmission(submissionId);
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading submission timetable:', error);
        this.useCurrentSessionsForSubmission(submissionId);
      }
    });
  }

  // Fallback method to use current sessions for submission display
  private useCurrentSessionsForSubmission(submissionId: number) {
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

      // University time slots mapping (same as used in formatTimetableSessions)
      const timeSlotMap: { [key: string]: number } = {
        '07:45 - 08:25': 0,
        '09:15 - 09:55': 1,
        '10:15 - 10:55': 2,
        '11:00 - 11:40': 3,
        '11:45 - 12:25': 4,
        '13:05 - 13:45': 5,
        '13:50 - 14:30': 6,
        '14:35 - 15:10': 7,
        '15:15 - 16:00': 8
      };

      // Get slot number from time slot string, default to 0 if not found
      const slotNumber = timeSlotMap[session.timeSlot] ?? 0;

      return {
        id: session.id,
        title: session.moduleName,
        module: session.moduleName,
        moduleCode: this.getModuleCode(session.moduleId),
        lecturer: session.lecturer,
        venue: session.venue,
        group: session.group,
        day: dayMap[session.day],
        startSlot: slotNumber,
        endSlot: slotNumber + 1,  // Single slot sessions
        category: this.getModuleCategory(session.moduleId),
        color: session.hasConflict ? '#eb445a' : this.getModuleColor(session.moduleId), // Red color for conflicts
        departmentId: parseInt(this.departmentInfo.id) || 1,
        hasConflict: session.hasConflict
      } as TimetableSession;
    });
    
    this.cdr.detectChanges();
  }

  // View details of a session from submission timetable
  viewSubmissionSessionDetails(session: TimetableSession) {
    console.log('Viewing submission session details:', session);
    // Show details of the session, e.g., in a modal
  }

  // Prompt user to save changes before navigation
  async promptToSaveChanges(): Promise<'save' | 'discard' | 'cancel'> {
    return new Promise((resolve) => {
      this.alertController.create({
        header: 'Unsaved Changes',
        message: 'You have unsaved changes to your timetable. What would you like to do?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve('cancel')
          },
          {
            text: 'Discard Changes',
            cssClass: 'secondary',
            handler: () => resolve('discard')
          },
          {
            text: 'Save Changes',
            cssClass: 'primary',
            handler: () => resolve('save')
          }
        ],
        backdropDismiss: false
      }).then(alert => alert.present());
    });
  }

  // Save timetable changes manually
  async saveTimetableChanges(): Promise<boolean> {
    try {
      console.log('Saving timetable changes...');

      // Don't save if department info is not loaded
      if (!this.departmentInfo.name || this.departmentInfo.name === 'Loading...') {
        console.log('Department not loaded, cannot save');
        await this.presentToast('Cannot save: Department information not available');
        return false;
      }

      // Get current timetable
      let currentTimetableDoc = await this.timetableDatabaseService.getCurrentTimetable(this.departmentInfo.name).toPromise();
      
      if (!currentTimetableDoc) {
        // Create new timetable if it doesn't exist
        const createResult = await this.timetableDatabaseService.createNewTimetable(
          this.departmentInfo.name,
          `${new Date().getFullYear()} Timetable`,
          `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          1
        ).toPromise();
        
        if (!createResult || !createResult.success) {
          throw new Error(createResult?.message || 'Failed to create timetable');
        }
        
        currentTimetableDoc = await this.timetableDatabaseService.getCurrentTimetable(this.departmentInfo.name).toPromise();
        
        if (!currentTimetableDoc) {
          throw new Error('Failed to retrieve newly created timetable');
        }
      }

      // Save the sessions
      if (this.timetableSessions && this.timetableSessions.length > 0) {
        const timetableSessions = this.timetableSessions.map(session => ({
          id: session.id,
          moduleId: session.moduleId,
          moduleName: session.moduleName,
          lecturerId: session.lecturerId,
          lecturer: session.lecturer,
          venueId: session.venueId || session.venue,
          venue: session.venue,
          groupId: session.groupId,
          group: session.group,
          day: session.day,
          timeSlot: session.timeSlot,
          category: (session as any).category || 'Lecture',
          color: (session as any).color || '#007bff',
          departmentId: (session as any).departmentId || 1,
          hasConflict: session.hasConflict || false
        }));

        const updateResult = await this.timetableDatabaseService.saveTimetable({
          sessions: timetableSessions,
          status: 'draft'
        }, currentTimetableDoc.id).toPromise();

        if (!updateResult || !updateResult.success) {
          throw new Error(updateResult?.message || 'Failed to save timetable sessions');
        }
      }

      // Mark as saved
      this.hasUnsavedChanges = false;
      
      await this.presentToast('Timetable saved successfully!');
      console.log('Timetable saved successfully');
      return true;

    } catch (error: any) {
      console.error('Error saving timetable:', error);
      await this.presentToast('Failed to save timetable: ' + (error?.message || 'Unknown error'));
      return false;
    }
  }

  // Manual save method that can be called from UI
  async manualSave() {
    if (!this.hasUnsavedChanges) {
      await this.presentToast('No changes to save');
      return;
    }

    const saved = await this.saveTimetableChanges();
    if (!saved) {
      console.log('Save failed');
    }
  }

  // UI Helper methods
  getSaveStatusText(): string {
    return this.hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved';
  }

  getSaveStatusIcon(): string {
    return this.hasUnsavedChanges ? 'warning-outline' : 'checkmark-circle-outline';
  }

  getSaveStatusColor(): string {
    return this.hasUnsavedChanges ? 'warning' : 'success';
  }

  canSave(): boolean {
    return this.hasUnsavedChanges && this.timetableSessions && this.timetableSessions.length > 0;
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
        console.log('Submission history loaded from database service:', submissions);
        
        if (submissions && submissions.length > 0) {
          // Transform database submissions to display format
          this.submissionHistory = submissions.map((submission, index) => ({
            id: parseInt(submission.id) || (index + 1),
            academicPeriod: submission.academicPeriod || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
            submittedAt: submission.submittedAt?.toDate ? submission.submittedAt.toDate() : new Date(submission.submittedAt || Date.now()),
            status: submission.status || 'pending',
            conflictCount: submission.conflictCount || 0,
            hasAdminFeedback: submission.hasAdminFeedback || false,
            adminFeedback: submission.adminFeedback || '',
            timetableId: submission.timetableId || submission.id  // Include timetableId for session retrieval
          }));
          
          console.log('Transformed submission history:', this.submissionHistory);
        } else {
          console.log('No submission history found from service, trying direct Firebase query');
          this.loadSubmissionHistoryDirectFromFirebase();
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading submission history from service:', error);
        this.presentToast('Error loading submission history from service, trying direct query');
        
        // Fallback to direct Firebase query
        this.loadSubmissionHistoryDirectFromFirebase();
      }
    });
  }

  // Fallback method to load submission history directly from Firebase
  private loadSubmissionHistoryDirectFromFirebase() {
    console.log('Loading submission history directly from Firebase for:', this.departmentInfo.name);
    
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      // Query the correct collection name that admin uses: 'timetable_submissions'
      // Remove the orderBy to avoid requiring a composite index
      firestore.collection('timetable_submissions')
        .where('department', '==', this.departmentInfo.name)
        .get()
        .then((querySnapshot: any) => {
          if (!querySnapshot.empty) {
            // Get all documents and sort them in JavaScript instead of Firestore
            let submissions = querySnapshot.docs.map((doc: any, index: number) => {
              const data = doc.data();
              console.log('Submission history doc data:', data);
              return {
                id: parseInt(doc.id) || (index + 1),
                academicPeriod: data.academicPeriod || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt || Date.now()),
                status: data.status || 'pending',
                conflictCount: data.conflictCount || 0,
                hasAdminFeedback: !!(data.adminFeedback && data.adminFeedback.trim()),
                adminFeedback: data.adminFeedback || '',
                timetableId: data.timetableId || doc.id
              };
            });
            
            // Sort by submittedAt in descending order (newest first)
            submissions.sort((a: any, b: any) => {
              const dateA = new Date(a.submittedAt).getTime();
              const dateB = new Date(b.submittedAt).getTime();
              return dateB - dateA; // Descending order
            });
            
            this.submissionHistory = submissions;
            
            console.log('Loaded submission history directly from Firebase:', this.submissionHistory);
            
            // Update the current submission status if we have submissions
            if (this.submissionHistory.length > 0) {
              const latestSubmission = this.submissionHistory[0];
              this.updateSubmissionStatusFromHistory(latestSubmission);
            }
          } else {
            console.log('No submission history found in Firebase');
            this.submissionHistory = [];
          }
          
          this.cdr.detectChanges();
        })
        .catch((error: any) => {
          console.error('Error loading submission history from Firebase:', error);
          
          // If we still get an error, try a more basic query
          this.loadSubmissionHistoryBasicQuery();
        });
    } catch (error) {
      console.log('Firebase app not available for submission history:', error);
      this.submissionHistory = [];
      this.cdr.detectChanges();
    }
  }

  // Even more basic query as ultimate fallback
  private loadSubmissionHistoryBasicQuery() {
    console.log('Loading submission history with basic query');
    
    try {
      const firebaseApp = firebase.app();
      const firestore = firebaseApp.firestore();
      
      // Get all documents from the collection and filter in JavaScript
      firestore.collection('timetable_submissions')
        .get()
        .then((querySnapshot: any) => {
          if (!querySnapshot.empty) {
            // Filter for this department in JavaScript
            let submissions = querySnapshot.docs
              .map((doc: any, index: number) => {
                const data = doc.data();
                return {
                  id: parseInt(doc.id) || (index + 1),
                  department: data.department,
                  academicPeriod: data.academicPeriod || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                  submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt || Date.now()),
                  status: data.status || 'pending',
                  conflictCount: data.conflictCount || 0,
                  hasAdminFeedback: !!(data.adminFeedback && data.adminFeedback.trim()),
                  adminFeedback: data.adminFeedback || '',
                  timetableId: data.timetableId || doc.id
                };
              })
              .filter((submission: any) => submission.department === this.departmentInfo.name)
              .sort((a: any, b: any) => {
                const dateA = new Date(a.submittedAt).getTime();
                const dateB = new Date(b.submittedAt).getTime();
                return dateB - dateA; // Descending order
              });
            
            this.submissionHistory = submissions;
            
            console.log('Loaded submission history with basic query:', this.submissionHistory);
            
            // Update the current submission status if we have submissions
            if (this.submissionHistory.length > 0) {
              const latestSubmission = this.submissionHistory[0];
              this.updateSubmissionStatusFromHistory(latestSubmission);
            }
          } else {
            console.log('No submissions found in collection');
            this.submissionHistory = [];
          }
          
          this.cdr.detectChanges();
        })
        .catch((error: any) => {
          console.error('Error with basic query:', error);
          this.presentToast('Error loading submission history: ' + (error.message || 'Unknown error'));
          this.submissionHistory = [];
          this.cdr.detectChanges();
        });
    } catch (error) {
      console.log('Firebase app not available for basic query:', error);
      this.submissionHistory = [];
      this.cdr.detectChanges();
    }
  }

  // Update submission status based on latest submission history
  private updateSubmissionStatusFromHistory(submission: any) {
    console.log('Updating submission status from history:', submission);
    
    switch (submission.status.toLowerCase()) {
      case 'submitted':
      case 'pending':
        this.submissionStatus = {
          status: 'submitted',
          label: 'Under Review',
          message: 'Your timetable is being reviewed by the administration.',
          canEdit: false,
          buttonText: 'View Submission'
        };
        break;
      case 'approved':
        this.submissionStatus = {
          status: 'approved',
          label: 'Approved',
          message: 'Your timetable has been approved and published.',
          canEdit: false,
          buttonText: 'View Approved Timetable'
        };
        break;
      case 'rejected':
        this.submissionStatus = {
          status: 'rejected',
          label: 'Needs Revision',
          message: submission.adminFeedback || 'Your timetable needs revisions. Please check the admin feedback and resubmit.',
          canEdit: true,
          buttonText: 'Revise & Resubmit'
        };
        break;
      default:
        // Don't update if status is unknown
        break;
    }
    
    console.log('Updated submission status:', this.submissionStatus);
  }

  // Get the latest admin feedback for display
  getLatestAdminFeedback(): string {
    if (this.submissionHistory.length === 0) {
      return 'No feedback available';
    }
    
    // Find the most recent submission with admin feedback
    const latestWithFeedback = this.submissionHistory.find(submission => 
      submission.hasAdminFeedback && submission.adminFeedback
    );
    
    return latestWithFeedback?.adminFeedback || 'No specific feedback provided. Please review your timetable and resubmit.';
  }
}