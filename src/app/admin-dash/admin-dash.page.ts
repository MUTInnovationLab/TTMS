import { Component, OnInit, ChangeDetectorRef, OnDestroy, Injector } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { Conflict, ConflictType, ConflictResolution } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { AddUserComponent, User } from '../components/add-user/add-user.component';
import { AddVenueComponent } from '../components/add-venue/add-venue.component';
import { AddDepartmentComponent } from '../components/add-department/add-department.component';
import { Department } from '../interfaces/department.interface';
import { AuthService } from '../services/Authentication Services/auth.service';
import { StaffService } from '../services/Data Services/staff.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';
import { DepartmentService } from '../services/Entity Management Services/department.service';
import { TimetableDatabaseService, TimetableDocument } from '../services/Timetable Core Services/timetable-database.service';
import { ToastController } from '@ionic/angular';

interface ConflictSummary {
  id: number;
  type: string;
  description: string;
  sessions: number[]; // IDs of sessions involved in the conflict
}

// Add interface for department lecturer stats
interface DepartmentLecturerStats {
  name: string;
  avatar: string | null;
  weeklyHours: number;
  moduleCount: number;
  workloadPercentage: number;
}

@Component({
  selector: 'app-admin-dash',
  templateUrl: './admin-dash.page.html',
  styleUrls: ['./admin-dash.page.scss'],
  standalone: false,
})
export class AdminDashPage implements OnInit, OnDestroy {
  // Sidebar state
  sidebarVisible = true;
  private sidebarSubscription?: Subscription;
  
  // Active section tracking
  activeSection: string = 'dashboard';
  
  // Header UI state
  showProfileMenu: boolean = false;
  
  // Header properties
  notificationCount: number = 5;
  
  // Dashboard navigation
  
  // Dashboard stats
  stats = {
    departments: 8,
    venues: 25,
    sessions: 142,
    conflicts: 3,
    submissions: 0 // Will be updated when submissions are loaded
  };
  
  // Recent activities
  recentActivities = [
    {
      type: 'success',
      icon: 'checkmark-circle',
      message: 'Computer Science department submitted their timetable',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      type: 'warning',
      icon: 'alert-circle',
      message: 'Conflict detected in Engineering timetable',
      timestamp: new Date(Date.now() - 7200000)
    },
    {
      type: 'primary',
      icon: 'person',
      message: 'New user Dr. John Smith added',
      timestamp: new Date(Date.now() - 86400000)
    },
    {
      type: 'success',
      icon: 'cloud-upload',
      message: 'Master timetable published',
      timestamp: new Date(Date.now() - 172800000)
    }
  ];
  
  // Timetable management
  timetableView: string = 'master';
  masterTimetableSessions: TimetableSession[] = [];
  departmentSubmissionSessions: TimetableSession[] = [];
  conflictSessions: TimetableSession[] = [];
  conflictSummary: ConflictSummary[] = [];
  selectedDepartment: number | null = null;
  
  // Publication data
  publicationTitle: string = '';
  publicationNotes: string = '';
  notifyUsers: boolean = true;
  
  // User management
  users = [
    { 
      id: 1, 
      title: 'DR',
      name: 'John Smith', 
      email: 'john.smith@example.com', 
      role: 'HOD', 
      department: 'COMPUTER SCIENCE',
      avatar: 'assets/avatar1.png' 
    },
    { 
      id: 2, 
      title: 'MS',
      name: 'Jane Doe', 
      email: 'jane.doe@example.com', 
      role: 'HOD', 
      department: 'ELECTRICAL ENGINEERING',
      avatar: 'assets/avatar2.png' 
    },
    { 
      id: 3, 
      title: 'PROF',
      name: 'Robert Johnson', 
      email: 'robert.j@example.com', 
      role: 'HOD', 
      department: 'MATHEMATICS',
      avatar: 'assets/avatar3.png' 
    }
  ];
  
  // Department management
  departments: Department[] = [];
  departmentsLoading: boolean = false;
  
  // Venue management - Update to use VenueDisplayInfo type
  venues: VenueDisplayInfo[] = [];
  venuesLoading: boolean = false;
  
  // Backup management
  backups = [
    { id: 1, name: 'Backup_20230601', created: new Date('2023-06-01'), size: '42 MB' },
    { id: 2, name: 'Backup_20230515', created: new Date('2023-05-15'), size: '40 MB' },
    { id: 3, name: 'Backup_20230501', created: new Date('2023-05-01'), size: '38 MB' }
  ];
  
  scheduledBackupsEnabled: boolean = true;

  // Venue management properties
  venueManagementView: string = 'list';
  venueSearchTerm: string = '';
  venueTypeFilter: string = '';
  venueConflicts: any[] = [];
  selectedConflict: any = null;
  specialEventRequests: any[] = [];
  selectedSpecialRequest: any = null;

  // Add property for formatted conflicts to pass to conflict-res component
  formattedConflicts: Conflict[] = [];

  // Department submission conflict properties
  departmentSubmissionConflicts: Conflict[] = [];
  showingDeptConflictRes: boolean = false;

  // Submitted timetables management
  submittedTimetables: TimetableDocument[] = [];
  selectedSubmittedTimetable: TimetableDocument | null = null;
  submissionsLoading: boolean = false;
  selectedDepartmentName: string = '';
  rejectionReason: string = '';

  // Reports section properties
  reportView: string = 'usage';
  reportDateRange: string = 'month';
  reportCustomStartDate: string = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days ago
  reportCustomEndDate: string = new Date().toISOString();
  isLoadingReport: boolean = false;
  selectedDepartmentForReport: string | number = 'all';

  // Usage analytics data
  usageStats = {
    activeUsers: 124,
    sessionsCreated: 532,
    conflictResolutionRate: 92,
    userEngagement: 78
  };

  userActivityLegend = [
    { label: 'Timetable Creation', color: '#4c8dff' },
    { label: 'Venue Management', color: '#ffc409' },
    { label: 'Conflict Resolution', color: '#eb445a' },
    { label: 'User Management', color: '#2dd36f' },
    { label: 'System Settings', color: '#92949c' }
  ];
  
  // Venue utilization data
  venueReportFilter = {
    building: '',
    type: ''
  };

  venueBuildings = ['Main Building', 'Science Block', 'Arts Block', 'Conference Center'];
  
  venueUtilizationStats: { id: string; name: string; type: string; capacity: number; utilizationRate: number; }[] = [];
  
  // Department report data
  departmentLecturerStats: DepartmentLecturerStats[] = [];
  
  // Conflict analysis data
  conflictStats = {
    total: 42,
    resolved: 38,
    avgResolutionTime: '2.4 days',
    mostCommonType: 'Venue Conflict'
  };
  
  conflictHotspots = [
    { 
      type: 'venue', 
      name: 'Room A101', 
      conflictCount: 8, 
      resolutionRate: 87, 
      commonIssue: 'Double booking' 
    },
    { 
      type: 'lecturer', 
      name: 'Prof. Johnson', 
      conflictCount: 6, 
      resolutionRate: 100, 
      commonIssue: 'Overlapping schedule' 
    },
    { 
      type: 'time', 
      name: 'Monday 10:00-12:00', 
      conflictCount: 12, 
      resolutionRate: 83, 
      commonIssue: 'Popular timeslot' 
    },
    { 
      type: 'department', 
      name: 'Computer Science', 
      conflictCount: 15, 
      resolutionRate: 93, 
      commonIssue: 'Resource allocation' 
    }
  ];

  // Add isSubmitting property if it doesn't exist
  isSubmitting: boolean = false;
  private _departmentService?: DepartmentService;

  constructor(
    private alertController: AlertController,
    private router: Router,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private authService: AuthService,
    private staffService: StaffService,
    private venueService: VenueService,
    private injector: Injector,
    private timetableDatabaseService: TimetableDatabaseService,
    private toastController: ToastController
  ) { 
    console.log('AdminDashPage constructor');
  }

  // Lazy getter for DepartmentService
  private get departmentService(): DepartmentService {
    if (!this._departmentService) {
      this._departmentService = this.injector.get(DepartmentService);
    }
    return this._departmentService;
  }

  ngOnInit() {
    console.log('AdminDashPage ngOnInit');
    
    // Initialize dashboard
    this.generateMockTimetableData();
    this.loadVenues(); // Load venues from database
    this.loadDepartments(); // Load departments from database
    this.loadSubmittedTimetables(); // Load submitted timetables from database
    
    // Set initial sidebar state
    this.sidebarVisible = this.sidebarService.isSidebarVisible;
    console.log('Initial sidebar state:', this.sidebarVisible);

    // Subscribe to sidebar state changes
    this.sidebarSubscription = this.sidebarService.sidebarVisible$.subscribe(
      state => {
        console.log('Admin sidebar state changed:', state);
        this.sidebarVisible = state;
        // Force change detection
        this.cdr.detectChanges();
      }
    );
    
    // Load Heads of Department from Firebase
    this.loadHODs();
  }

  // Load departments from database
  loadDepartments() {
    console.log('Loading departments from database');
    this.departmentsLoading = true;
    
    this.departmentService.getAllDepartments().subscribe({
      next: (departments) => {
        console.log('Departments loaded successfully:', departments);
        this.departments = departments;
        this.departmentsLoading = false;
        
        // Update stats
        this.stats.departments = departments.length;
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.presentToast('Failed to load departments: ' + (error.message || 'Unknown error'));
        this.departmentsLoading = false;
      }
    });
  }

  // Load HODs from Firebase
  loadHODs() {
    console.log('Loading HODs from Firebase');
    this.staffService.getAllHODs().subscribe({
      next: (hods) => {
        console.log('HODs loaded successfully:', hods);
        // Transform the data to match our display format
        this.users = hods.map(hod => ({
          id: Number(hod.id),
          title: hod.title || '',
          name: hod.name || '',
          email: hod.contact?.email || '',
          role: hod.role || 'HOD',
          department: hod.department || '',
          avatar: hod.profile || 'assets/default-avatar.png'
        }));
      },
      error: (error) => {
        console.error('Error loading HODs:', error);
        this.presentToast('Failed to load HODs: ' + (error.message || 'Unknown error'));
      }
    });
  }
  
  // Load venues from database
  loadVenues() {
    console.log('Loading venues from database');
    this.venuesLoading = true;
    
    this.venueService.getAllVenues().subscribe({
      next: (venues) => {
        console.log('Venues loaded successfully:', venues);
        this.venues = venues;
        this.venuesLoading = false;
        
        // Update stats
        this.stats.venues = venues.length;
        
        // Update venue utilization stats for reports
        this.updateVenueUtilizationStats(venues);
        
        // Initialize venue conflicts and special requests after venues are loaded
        this.generateMockVenueConflicts();
        this.generateMockSpecialEventRequests();
      },
      error: (error) => {
        console.error('Error loading venues:', error);
        this.presentToast('Failed to load venues: ' + (error.message || 'Unknown error'));
        this.venuesLoading = false;
      }
    });
  }

  // Update venue utilization stats for reports
  updateVenueUtilizationStats(venues: VenueDisplayInfo[]) {
    this.venueUtilizationStats = venues.map((venue, index) => ({
      id: venue.id,
      name: venue.name,
      type: venue.type,
      capacity: venue.capacity,
      utilizationRate: Math.floor(Math.random() * 100) // Mock utilization - replace with actual calculation
    }));
  }
  
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
    this.activeSection = 'settings';
    this.showProfileMenu = false;
  }
  
  logout() {
    // Handle logout logic using AuthService
    this.authService.logout().subscribe(
      success => {
        if (success) {
          console.log('User logged out successfully');
        } else {
          console.error('Logout failed');
          this.presentToast('Failed to log out. Please try again.');
        }
      }
    );
  }
  
  // Navigation
  changeSection(section: string) {
    this.activeSection = section;
    if (window.innerWidth < 768) { // Hide sidebar on mobile after selection
      this.sidebarService.hideSidebar();
    }
  }
  
  // Timetable management
  timetableViewChanged() {
    console.log('Timetable view changed to:', this.timetableView);
    
    // Reset selected department when changing views
    if (this.timetableView !== 'submissions') {
      this.selectedDepartment = null;
    }
    
    // Generate appropriate conflict data when switching to conflicts view
    if (this.timetableView === 'conflicts') {
      this.generateConflictData();
    }
  }
  
  createNewTimetable() {
    console.log('Creating new timetable');
    
    // Show dialog to select parameters for new timetable
    this.presentNewTimetableDialog();
  }

  async presentNewTimetableDialog() {
    const alert = await this.alertController.create({
      header: 'Create New Timetable',
      message: 'Create a new master timetable for the academic year',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Timetable Title',
          value: `${new Date().getFullYear()} Master Timetable`
        },
        {
          name: 'academicPeriod',
          type: 'text',
          placeholder: 'Academic Period',
          value: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
        },
        {
          name: 'semester',
          type: 'number',
          placeholder: 'Semester',
          value: 1,
          min: 1,
          max: 2
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Create',
          handler: (data) => {
            if (data.title && data.academicPeriod && data.semester) {
              this.performTimetableCreation(data);
              return true;
            } else {
              this.presentToast('Please fill in all fields');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private performTimetableCreation(timetableData: any) {
    this.isSubmitting = true;
    
    // Create new timetable using the database service
    this.timetableDatabaseService.createNewTimetable(
      'MASTER', // Master timetable for all departments
      timetableData.title,
      timetableData.academicPeriod,
      parseInt(timetableData.semester)
    ).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('New timetable created successfully');
          
          // Switch to master timetable view
          this.timetableView = 'master';
          this.activeSection = 'timetable';
          
          // Reload submitted timetables
          this.loadSubmittedTimetables();
        } else {
          this.presentToast('Failed to create timetable: ' + result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error creating timetable:', error);
        this.presentToast('Error creating timetable: ' + (error.message || 'Unknown error'));
      }
    });
  }

  publishTimetable() {
    console.log('Publishing timetable');
    
    // Check if there are unresolved conflicts
    if (this.formattedConflicts.length > 0) {
      this.presentToast('Cannot publish timetable with unresolved conflicts. Please resolve all conflicts first.');
      return;
    }
    
    // Show publication dialog
    this.presentPublicationDialog();
  }

  async presentPublicationDialog() {
    const alert = await this.alertController.create({
      header: 'Publish Master Timetable',
      message: 'This will publish the master timetable and notify all departments. This action cannot be undone.',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Publication Title',
          value: this.publicationTitle || `Master Timetable ${new Date().getFullYear()}`
        },
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Publication Notes (Optional)',
          value: this.publicationNotes
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Publish',
          cssClass: 'primary',
          handler: (data) => {
            this.publicationTitle = data.title;
            this.publicationNotes = data.notes;
            this.performTimetablePublication();
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private performTimetablePublication() {
    this.isSubmitting = true;
    
    // Create publication data
    const publicationData = {
      title: this.publicationTitle,
      notes: this.publicationNotes,
      sessions: this.masterTimetableSessions,
      publishedAt: new Date(),
      publishedBy: 'Admin', // Should be current user
      notifyUsers: this.notifyUsers
    };

    // In a real implementation, you would call a publication service
    // For now, we'll simulate the process
    setTimeout(() => {
      this.isSubmitting = false;
      this.presentToast('Master timetable published successfully');
      
      // Add activity
      this.recentActivities.unshift({
        type: 'success',
        icon: 'cloud-upload',
        message: `Master timetable "${this.publicationTitle}" published`,
        timestamp: new Date()
      });
      
      // Keep only recent activities
      if (this.recentActivities.length > 10) {
        this.recentActivities = this.recentActivities.slice(0, 10);
      }
      
      this.cdr.detectChanges();
    }, 2000);
  }
  
  resolveConflicts() {
    console.log('Resolving conflicts');
    this.activeSection = 'timetable';
    this.timetableView = 'conflicts';
  }

  // Load submitted timetables from database
  loadSubmittedTimetables() {
    console.log('Loading submitted timetables from database');
    this.submissionsLoading = true;
    
    this.timetableDatabaseService.getAllTimetables().subscribe({
      next: (timetables) => {
        console.log('All timetables loaded:', timetables);
        // Filter for submitted, approved, or rejected timetables
        this.submittedTimetables = timetables.filter(t => 
          t.status === 'submitted' || t.status === 'approved' || t.status === 'rejected'
        );
        
        // Update dashboard stats
        this.stats.submissions = this.submittedTimetables.length;
        
        console.log('Submitted timetables:', this.submittedTimetables);
        this.submissionsLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading submitted timetables:', error);
        this.submissionsLoading = false;
        this.presentToast('Error loading submitted timetables: ' + (error.message || 'Unknown error'));
        this.cdr.detectChanges();
      }
    });
  }
  
  loadDepartmentSubmission() {
    if (this.selectedDepartment) {
      console.log('Loading submission for department ID:', this.selectedDepartment);
      
      // Find the selected timetable from submitted timetables
      const selectedTimetable = this.submittedTimetables.find(t => 
        t.department === this.selectedDepartmentName || t.id === this.selectedDepartment?.toString()
      );
      
      if (selectedTimetable) {
        this.selectedSubmittedTimetable = selectedTimetable;
        // Convert database sessions to grid sessions
        this.departmentSubmissionSessions = selectedTimetable.sessions.map(session => 
          this.convertDatabaseSessionToGridSession(session)
        );
        
        // Generate conflicts specifically for this department's submission
        this.generateDepartmentSubmissionConflicts();
      } else {
        // Fallback to mock data if no real submission found
        this.departmentSubmissionSessions = this.masterTimetableSessions
          .filter(session => session.departmentId === this.selectedDepartment)
          .map(session => ({...session}));
        
        this.generateDepartmentSubmissionConflicts();
      }
    }
  }

  // Helper method to convert database session to grid session format
  private convertDatabaseSessionToGridSession(dbSession: any): TimetableSession {
    // Convert day string to number
    const dayMap: { [key: string]: number } = {
      'Monday': 1,
      'Tuesday': 2, 
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
      'Sunday': 0
    };

    // Extract start and end times from timeSlot (e.g., "09:00 - 10:00")
    const timeSlotMatch = dbSession.timeSlot?.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    let startSlot = 1;
    let endSlot = 2;
    
    if (timeSlotMatch) {
      const startTime = timeSlotMatch[1];
      const endTime = timeSlotMatch[2];
      
      // Convert time to slot numbers (assuming 8:00 AM is slot 1, 1-hour slots)
      startSlot = this.timeToSlot(startTime);
      endSlot = this.timeToSlot(endTime);
    }

    return {
      id: dbSession.id,
      title: dbSession.moduleName || 'Unknown Module',
      module: dbSession.moduleName || 'Unknown Module',
      moduleCode: `MOD${dbSession.moduleId}`,
      lecturer: dbSession.lecturer || 'Unknown Lecturer',
      venue: dbSession.venue || 'Unknown Venue',
      group: dbSession.group || 'Unknown Group',
      day: dayMap[dbSession.day] || 1,
      startSlot: startSlot,
      endSlot: endSlot,
      category: dbSession.category || 'Lecture',
      color: dbSession.color || '#4c8dff',
      departmentId: dbSession.departmentId || 0,
      hasConflict: dbSession.hasConflict || false
    };
  }

  // Helper method to convert time string to slot number
  private timeToSlot(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const baseMinutes = 8 * 60; // 8:00 AM base time
    return Math.floor((totalMinutes - baseMinutes) / 60) + 1;
  }
  
  // Department submission conflict handling
  generateDepartmentSubmissionConflicts() {
    // Reset conflicts
    this.departmentSubmissionConflicts = [];
    
    // In a real app, we would do real conflict detection here
    // For demo, generate some mock conflicts if this is department 1 (Computer Science)
    if (this.selectedDepartment === 1) {
      const session1 = this.departmentSubmissionSessions.find(s => s.id === 1);
      const session2 = this.departmentSubmissionSessions.find(s => s.id === 2);
      
      if (session1 && session2) {
        // Create a conflict with the master timetable
        const masterSession = {
          id: 201,
          title: 'Physics Fundamentals',
          module: 'Physics 101',
          moduleCode: 'PHY101',
          lecturer: 'Dr. Parker',
          venue: session1.venue, // Same venue as session 1
          group: 'Physics Year 1',
          day: session1.day,
          startSlot: session1.startSlot,
          endSlot: session1.endSlot,
          category: 'Lecture',
          color: '#eb445a',
        };
        
        // Create a lecturer availability conflict
        const lecturerConflict = {
          id: 301,
          title: 'Faculty Meeting',
          module: 'Administrative',
          moduleCode: 'ADM001',
          lecturer: session2.lecturer, // Same lecturer as session 2
          venue: 'Conference Room',
          group: 'Faculty',
          day: session2.day,
          startSlot: session2.startSlot,
          endSlot: session2.endSlot,
          category: 'Meeting',
          color: '#92949c',
        };
        
        this.departmentSubmissionConflicts = [
          {
            id: 1,
            type: ConflictType.VENUE,
            priority: 'high',
            sessions: [session1, masterSession],
            details: `${session1.venue} is already booked for Physics Fundamentals at this time`,
            possibleResolutions: [
              {
                id: 1,
                type: 'Relocate',
                action: 'changeVenue',
                newVenue: 'Room B202'
              },
              {
                id: 2,
                type: 'Reschedule',
                action: 'changeTime',
                newDay: session1.day,
                newStartSlot: 4,
                newEndSlot: 6
              }
            ],
            resolved: false
          },
          {
            id: 2,
            type: ConflictType.LECTURER,
            priority: 'medium',
            sessions: [session2, lecturerConflict],
            details: `${session2.lecturer} has a faculty meeting scheduled at this time`,
            possibleResolutions: [
              {
                id: 3,
                type: 'Reschedule',
                action: 'changeTime',
                newDay: 4, // Friday
                newStartSlot: session2.startSlot,
                newEndSlot: session2.endSlot
              }
            ],
            resolved: false
          }
        ];
      }
    }
  }
  
  showDepartmentSubmissionConflicts() {
    this.showingDeptConflictRes = true;
  }
  
  handleDepartmentConflictResolution(event: { conflict: Conflict, resolution: ConflictResolution }) {
    console.log('Resolving department submission conflict:', event);
    
    const { conflict, resolution } = event;
    
    // Find the session in the department submission
    const sessionToUpdate = this.departmentSubmissionSessions.find(
      s => s.id === conflict.sessions[0].id
    );
    
    if (sessionToUpdate) {
      // Apply the resolution to the session
      if (resolution.action === 'changeVenue' && resolution.newVenue) {
        sessionToUpdate.venue = resolution.newVenue;
        this.presentToast(`Changed venue to ${resolution.newVenue}`);
      } else if (resolution.action === 'changeTime') {
        if (resolution.newDay !== undefined) {
          sessionToUpdate.day = resolution.newDay;
        }
        
        if (resolution.newStartSlot !== undefined) {
          sessionToUpdate.startSlot = resolution.newStartSlot;
        }
        
        if (resolution.newEndSlot !== undefined) {
          sessionToUpdate.endSlot = resolution.newEndSlot;
        }
        
        this.presentToast(`Rescheduled session successfully`);
      }
    }
    
    // Remove the resolved conflict
    this.departmentSubmissionConflicts = this.departmentSubmissionConflicts.filter(
      c => c.id !== conflict.id
    );
    
    // If all conflicts are resolved, go back to the timetable view
    if (this.departmentSubmissionConflicts.length === 0) {
      this.showingDeptConflictRes = false;
      this.presentToast('All conflicts in department submission resolved');
    }
  }
  
  approveDepartmentSubmission() {
    if (!this.selectedSubmittedTimetable) {
      this.presentToast('No timetable selected for approval');
      return;
    }

    // Check if there are any unresolved conflicts
    if (this.departmentSubmissionConflicts.length > 0) {
      this.presentToast('Cannot approve submission with unresolved conflicts');
      this.showDepartmentSubmissionConflicts(); // Show the conflicts
      return;
    }

    // Show confirmation dialog
    this.alertController.create({
      header: 'Confirm Approval',
      message: `Are you sure you want to approve the timetable submission from ${this.selectedSubmittedTimetable.department}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Approve',
          handler: () => {
            this.performApproval();
          }
        }
      ]
    }).then(alert => alert.present());
  }

  private performApproval() {
    if (!this.selectedSubmittedTimetable) return;

    this.isSubmitting = true;
    console.log('Approving submission for timetable ID:', this.selectedSubmittedTimetable.id);

    this.timetableDatabaseService.approveTimetable(
      this.selectedSubmittedTimetable.id,
      'Timetable approved by admin'
    ).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department submission approved successfully');
          
          // Update local data
          this.selectedSubmittedTimetable!.status = 'approved';
          
          // Reload submitted timetables to reflect changes
          this.loadSubmittedTimetables();
          
          // Add approved sessions to master timetable
          this.departmentSubmissionSessions.forEach(session => {
            const existingIndex = this.masterTimetableSessions.findIndex(s => s.id === session.id);
            
            if (existingIndex >= 0) {
              this.masterTimetableSessions[existingIndex] = { ...session };
            } else {
              this.masterTimetableSessions.push({ ...session });
            }
          });
        } else {
          this.presentToast('Failed to approve submission: ' + result.message);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error approving submission:', error);
        this.presentToast('Error approving submission: ' + (error.message || 'Unknown error'));
        this.cdr.detectChanges();
      }
    });
  }
  
  rejectDepartmentSubmission() {
    if (!this.selectedSubmittedTimetable) {
      this.presentToast('No timetable selected for rejection');
      return;
    }

    console.log('Rejecting submission for timetable ID:', this.selectedSubmittedTimetable.id);
    this.promptForRejectionReason();
  }
  
  promptForRejectionReason() {
    this.alertController.create({
      header: 'Reject Submission',
      message: 'Please provide a reason for rejecting this timetable submission:',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Enter rejection reason...',
          value: this.rejectionReason
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reject',
          handler: (data) => {
            if (data.reason && data.reason.trim()) {
              this.rejectionReason = data.reason.trim();
              this.performRejection();
              return true;
            } else {
              this.presentToast('Please provide a rejection reason');
              return false;
            }
          }
        }
      ]
    }).then(alert => alert.present());
  }

  private performRejection() {
    if (!this.selectedSubmittedTimetable || !this.rejectionReason) return;

    this.isSubmitting = true;
    console.log('Rejecting submission with reason:', this.rejectionReason);

    this.timetableDatabaseService.rejectTimetable(
      this.selectedSubmittedTimetable.id,
      this.rejectionReason
    ).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department submission rejected successfully');
          
          // Update local data
          this.selectedSubmittedTimetable!.status = 'rejected';
          this.selectedSubmittedTimetable!.adminFeedback = this.rejectionReason;
          
          // Reload submitted timetables to reflect changes
          this.loadSubmittedTimetables();
          
          // Clear rejection reason
          this.rejectionReason = '';
        } else {
          this.presentToast('Failed to reject submission: ' + result.message);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error rejecting submission:', error);
        this.presentToast('Error rejecting submission: ' + (error.message || 'Unknown error'));
        this.cdr.detectChanges();
      }
    });
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: message.includes('Error') || message.includes('Failed') ? 'danger' : 'success'
    });
    toast.present();
  }

  // Helper methods for the submissions view
  getStatusColor(status: string): string {
    switch (status) {
      case 'submitted':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'submitted':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle-outline';
      case 'rejected':
        return 'close-circle-outline';
      default:
        return 'document-outline';
    }
  }

  formatDate(date: any): string {
    if (!date) return 'Unknown';
    
    let dateObj: Date;
    if (date.toDate && typeof date.toDate === 'function') {
      // Firestore timestamp
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
  }

  selectTimetableForReview(timetable: TimetableDocument) {
    console.log('Selecting timetable for review:', timetable);
    this.selectedSubmittedTimetable = timetable;
    this.selectedDepartmentName = timetable.department;
    
    // Load the timetable sessions for review
    this.departmentSubmissionSessions = timetable.sessions.map(session => 
      this.convertDatabaseSessionToGridSession(session)
    );
    
    // Generate conflicts for this submission
    this.generateDepartmentSubmissionConflicts();
    
    // Reset conflict resolution view
    this.showingDeptConflictRes = false;
  }

  selectAndApprove(timetable: TimetableDocument) {
    this.selectTimetableForReview(timetable);
    this.approveDepartmentSubmission();
  }

  selectAndReject(timetable: TimetableDocument) {
    this.selectTimetableForReview(timetable);
    this.rejectDepartmentSubmission();
  }

  clearSelection() {
    this.selectedSubmittedTimetable = null;
    this.selectedDepartmentName = '';
    this.departmentSubmissionSessions = [];
    this.departmentSubmissionConflicts = [];
    this.showingDeptConflictRes = false;
  }

  onViewToggle() {
    // Handle view toggle between timetable and conflicts
    console.log('View toggled. Showing conflicts:', this.showingDeptConflictRes);
  }
  
  handleSessionClick(session: TimetableSession) {
    console.log('Session clicked:', session);
    // This would normally open a modal to view/edit the session details
  }
  
  handleMasterTimetableSessionDrop(event: {session: TimetableSession, day: number, startSlot: number}) {
    console.log('Session dropped:', event);
    
    // Find the session in our array
    const index = this.masterTimetableSessions.findIndex(s => s.id === event.session.id);
    if (index !== -1) {
      // Calculate new end slot based on the duration of the session
      const duration = event.session.endSlot - event.session.startSlot;
      const newEndSlot = event.startSlot + duration;
      
      // Update the session
      this.masterTimetableSessions[index] = {
        ...this.masterTimetableSessions[index],
        day: event.day,
        startSlot: event.startSlot,
        endSlot: newEndSlot
      };
      
      this.presentToast('Session moved successfully');
      
      // Check for new conflicts that might have been created
      this.generateConflictData();
    }
  }
  
  handleConflictSessionClick(session: TimetableSession) {
    console.log('Conflict session clicked:', session);
    // Open a special modal showing the conflict details and resolution options
  }
  
  highlightConflict(conflict: ConflictSummary) {
    console.log('Highlighting conflict:', conflict);
    // This would highlight the relevant sessions in the timetable grid
  }
  
  resolveSpecificConflict(conflict: ConflictSummary) {
    console.log('Resolving specific conflict:', conflict);
    // This would open a resolution modal with options specific to this conflict
  }
  
  publishFinalTimetable() {
    if (this.conflictSessions.length > 0) {
      this.presentToast('Cannot publish timetable with unresolved conflicts');
      return;
    }
    
    console.log('Publishing final timetable');
    console.log('Title:', this.publicationTitle);
    console.log('Notes:', this.publicationNotes);
    console.log('Notify users:', this.notifyUsers);
    
    // In a real application, you would make an API call to publish the timetable
    this.presentToast('Timetable published successfully');
  }
  
  // Mock data generation functions
  private generateMockTimetableData() {
    // Generate master timetable sessions
    this.masterTimetableSessions = [
      {
        id: 1,
        title: 'Software Engineering',
        module: 'Software Engineering',
        moduleCode: 'CSC2290',
        lecturer: 'Dr. Smith',
        venue: 'Room A101',
        group: 'CS Year 2',
        day: 1, // Tuesday
        startSlot: 2, // 10am
        endSlot: 4, // 12pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 1
      },
      {
        id: 2,
        title: 'Database Systems',
        module: 'Database Systems',
        moduleCode: 'CSC2291',
        lecturer: 'Prof. Johnson',
        venue: 'Room B205',
        group: 'CS Year 2',
        day: 2, // Wednesday
        startSlot: 6, // 2pm
        endSlot: 8, // 4pm
        category: 'Lab',
        color: '#ffc409',
        departmentId: 1
      },
      {
        id: 3,
        title: 'Data Structures',
        module: 'Data Structures',
        moduleCode: 'CSC2292',
        lecturer: 'Dr. Williams',
        venue: 'Room C310',
        group: 'CS Year 1',
        day: 3, // Thursday
        startSlot: 4, // 12pm
        endSlot: 6, // 2pm
        category: 'Tutorial',
        color: '#2dd36f',
        departmentId: 1
      },
      {
        id: 4,
        title: 'Engineering Mathematics',
        module: 'Engineering Mathematics',
        moduleCode: 'ENG1201',
        lecturer: 'Dr. Johnson',
        venue: 'Room D102',
        group: 'Eng Year 1',
        day: 1, // Tuesday
        startSlot: 4, // 12pm
        endSlot: 6, // 2pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 2
      },
      {
        id: 5,
        title: 'Mechanics',
        module: 'Mechanics',
        moduleCode: 'ENG1202',
        lecturer: 'Prof. Brown',
        venue: 'Room E105',
        group: 'Eng Year 1',
        day: 2, // Wednesday
        startSlot: 2, // 10am
        endSlot: 4, // 12pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 2
      },
      {
        id: 6,
        title: 'Business Ethics',
        module: 'Business Ethics',
        moduleCode: 'BUS3301',
        lecturer: 'Prof. Davis',
        venue: 'Room F201',
        group: 'Bus Year 3',
        day: 4, // Friday
        startSlot: 6, // 2pm
        endSlot: 8, // 4pm
        category: 'Seminar',
        color: '#92949c',
        departmentId: 3
      }
    ];
  }
  
  private generateConflictData() {
    // In a real application, this would come from actual conflict detection
    // For demonstration, we'll create some mock conflicts
    
    // Reset conflicts
    this.conflictSessions = [];
    this.conflictSummary = [];
    this.formattedConflicts = []; // Reset formatted conflicts
    
    // Create a new session that conflicts with an existing one (same venue, same time)
    const venueConflict: TimetableSession = {
      id: 101,
      title: 'Marketing Principles',
      module: 'Marketing Principles',
      moduleCode: 'BUS2102',
      lecturer: 'Dr. Thompson',
      venue: 'Room A101', // Same venue as session 1
      group: 'Bus Year 2',
      day: 1, // Tuesday
      startSlot: 2, // 10am - Same time as session 1
      endSlot: 4, // 12pm
      category: 'Lecture',
      color: '#4c8dff',
      departmentId: 3,
      hasConflict: true
    };
    
    // Create another session that conflicts with an existing one (same lecturer, same time)
    const lecturerConflict: TimetableSession = {
      id: 102,
      title: 'Advanced Databases',
      module: 'Advanced Databases',
      moduleCode: 'CSC3292',
      lecturer: 'Prof. Johnson', // Same lecturer as session 2
      venue: 'Room G301',
      group: 'CS Year 3',
      day: 2, // Wednesday
      startSlot: 6, // 2pm - Same time as session 2
      endSlot: 8, // 4pm
      category: 'Lecture',
      color: '#4c8dff',
      departmentId: 1,
      hasConflict: true
    };
    
    // Set some existing sessions as having conflicts
    const session1 = {...this.masterTimetableSessions.find(s => s.id === 1)!, hasConflict: true};
    const session2 = {...this.masterTimetableSessions.find(s => s.id === 2)!, hasConflict: true};
    
    // Add all conflict sessions to the conflict view
    this.conflictSessions = [
      session1,
      venueConflict,
      session2,
      lecturerConflict
    ];
    
    // Create conflict summary
    this.conflictSummary = [
      {
        id: 1,
        type: 'Venue Conflict',
        description: 'Room A101 has multiple bookings on Tuesday 10:00 - 12:00',
        sessions: [1, 101]
      },
      {
        id: 2,
        type: 'Lecturer Conflict',
        description: 'Prof. Johnson has multiple classes on Wednesday 14:00 - 16:00',
        sessions: [2, 102]
      }
    ];
    
    // Format conflicts for the conflict-res component
    this.formattedConflicts = [
      {
        id: 1,
        type: ConflictType.VENUE,
        priority: 'high',
        sessions: [session1, venueConflict],
        details: 'Room A101 has multiple bookings on Tuesday 10:00 - 12:00',
        possibleResolutions: [
          {
            id: 1,
            type: 'Relocate',
            action: 'changeVenue',
            newVenue: 'Room B202'
          },
          {
            id: 2,
            type: 'Reschedule',
            action: 'changeTime',
            newDay: 3,
            newStartSlot: 2,
            newEndSlot: 4
          }
        ],
        resolved: false
      },
      {
        id: 2,
        type: ConflictType.LECTURER,
        priority: 'medium',
        sessions: [session2, lecturerConflict],
        details: 'Prof. Johnson has multiple classes on Wednesday 14:00 - 16:00',
        possibleResolutions: [
          {
            id: 3,
            type: 'Reschedule',
            action: 'changeTime',
            newDay: 4,
            newStartSlot: 6,
            newEndSlot: 8
          },
          {
            id: 4,
            type: 'Reassign',
            action: 'changeVenue',
            newVenue: 'Room C302'
          }
        ],
        resolved: false
      }
    ];
  }

  // Add method to handle conflict resolution from the conflict-res component
  handleConflictResolution(event: { conflict: Conflict, resolution: ConflictResolution }) {
    console.log('Resolving conflict:', event);
    
    const { conflict, resolution } = event;
    
    // Update the session based on the resolution
    if (resolution.action === 'changeVenue') {
      // Handle venue change
      const sessionToUpdate = this.masterTimetableSessions.find(
        s => s.id === conflict.sessions[0].id
      );
      
      if (sessionToUpdate && resolution.newVenue) {
        sessionToUpdate.venue = resolution.newVenue;
        this.presentToast(`Changed venue to ${resolution.newVenue}`);
      }
    } else if (resolution.action === 'changeTime') {
      // Handle time change
      const sessionToUpdate = this.masterTimetableSessions.find(
        s => s.id === conflict.sessions[0].id
      );
      
      if (sessionToUpdate) {
        if (resolution.newDay !== undefined) {
          sessionToUpdate.day = resolution.newDay;
        }
        
        if (resolution.newStartSlot !== undefined) {
          sessionToUpdate.startSlot = resolution.newStartSlot;
        }
        
        if (resolution.newEndSlot !== undefined) {
          sessionToUpdate.endSlot = resolution.newEndSlot;
        }
        
        this.presentToast(`Rescheduled session successfully`);
      }
    }
    
    // Remove conflict from list
    this.formattedConflicts = this.formattedConflicts.filter(c => c.id !== conflict.id);
    this.conflictSummary = this.conflictSummary.filter(c => c.id !== conflict.id);
    this.stats.conflicts = this.formattedConflicts.length;
    
    // Regenerate conflict data to refresh the view
    this.generateConflictData();
  }
  
  // Venue management methods
  venueManagementViewChanged() {
    console.log('Venue management view changed to:', this.venueManagementView);
    
    // Reset selections when changing views
    this.selectedConflict = null;
    this.selectedSpecialRequest = null;
  }
  
  getFilteredVenuesList() {
    return this.venues.filter(venue => {
      // Name search
      if (this.venueSearchTerm && 
          !venue.name.toLowerCase().includes(this.venueSearchTerm.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (this.venueTypeFilter && venue.type.toLowerCase() !== this.venueTypeFilter.toLowerCase()) {
        return false;
      }
      
      return true;
    });
  }
  
  handleVenueBookingRequest(event: any) {
    console.log('Venue booking request:', event);
    
    // Here you would normally show a booking dialog or redirect to booking screen
    // For now, we'll just show a toast
    this.presentToast(`Booking requested for ${event.venue.name} on ${event.date.toLocaleDateString()}`);
  }
  
  highlightVenueConflict(conflict: any) {
    console.log('Highlighting venue conflict:', conflict);
    this.selectedConflict = conflict;
  }
  
  resolveVenueConflict(conflict: any) {
    console.log('Resolving venue conflict:', conflict);
    
    // In a real app, you would show a conflict resolution dialog
    // For demo, we'll just remove it from the list
    this.venueConflicts = this.venueConflicts.filter(c => c !== conflict);
    
    if (this.selectedConflict === conflict) {
      this.selectedConflict = null;
    }
    
    this.presentToast('Venue conflict resolved successfully');
  }
  
  viewSpecialEventRequest(request: any) {
    console.log('Viewing special event request:', request);
    this.selectedSpecialRequest = request;
  }
  
  approveSpecialRequest(request: any) {
    console.log('Approving special event request:', request);
    
    // In a real app, you would make an API call
    // For demo, we'll just update the status
    request.status = 'approved';
    
    this.presentToast('Special event request approved');
  }
  
  rejectSpecialRequest(request: any) {
    console.log('Rejecting special event request:', request);
    
    // In a real app, you would show a dialog for rejection reason
    // For demo, we'll just remove it
    this.specialEventRequests = this.specialEventRequests.filter(r => r !== request);
    this.selectedSpecialRequest = null;
    
    this.presentToast('Special event request rejected');
  }
  
  private generateMockVenueConflicts() {
    // Create some mock venue conflicts for demonstration
    const today = new Date();
    
    // Transform VenueDisplayInfo to Venue format for conflicts
    const transformedVenues = this.venues.map(venue => ({
      id: venue.id, // Keep as string
      name: venue.name,
      type: venue.type,
      capacity: venue.capacity,
      equipment: venue.equipment,
      department: venue.department,
      site: venue.site,
      schedulable: venue.schedulable,
      autoSchedulable: venue.autoSchedulable,
      accessibility: venue.accessibility
    }));
    
    this.venueConflicts = [
      {
        id: 1,
        venue: transformedVenues.length > 0 ? transformedVenues[0] : null,
        date: today,
        sessions: [
          {
            id: 101,
            title: 'Software Engineering',
            start: '10:00',
            end: '12:00',
            department: 'Computer Science'
          },
          {
            id: 102,
            title: 'Marketing Principles',
            start: '11:00',
            end: '13:00',
            department: 'Business Studies'
          }
        ]
      },
      {
        id: 2,
        venue: transformedVenues.length > 2 ? transformedVenues[2] : (transformedVenues.length > 0 ? transformedVenues[0] : null),
        date: new Date(today.getTime() + 86400000), // tomorrow
        sessions: [
          {
            id: 201,
            title: 'Physics Lecture',
            start: '14:00',
            end: '16:00',
            department: 'Physics'
          },
          {
            id: 202,
            title: 'Graduation Ceremony',
            start: '15:00',
            end: '17:00',
            department: 'Administration'
          }
        ]
      }
    ];
  }
  
  private generateMockSpecialEventRequests() {
    // Create some mock special event requests
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 86400000);
    
    // Transform VenueDisplayInfo to Venue format for special requests
    const transformedVenues = this.venues.map(venue => ({
      id: venue.id, // Keep as string
      name: venue.name,
      type: venue.type,
      capacity: venue.capacity,
      equipment: venue.equipment,
      department: venue.department,
      site: venue.site,
      schedulable: venue.schedulable,
      autoSchedulable: venue.autoSchedulable,
      accessibility: venue.accessibility
    }));
    
    this.specialEventRequests = [
      {
        id: 1,
        title: 'Tech Conference',
        venue: transformedVenues.length > 2 ? transformedVenues[2] : (transformedVenues.length > 0 ? transformedVenues[0] : null),
        date: nextWeek,
        duration: 4,
        requester: 'Dr. Jane Smith',
        department: 'Computer Science',
        purpose: 'Annual technology conference with industry speakers',
        status: 'pending'
      },
      {
        id: 2,
        title: 'Research Symposium',
        venue: transformedVenues.length > 1 ? transformedVenues[1] : (transformedVenues.length > 0 ? transformedVenues[0] : null),
        date: new Date(today.getTime() + 3 * 86400000),
        duration: 3,
        requester: 'Prof. Robert Johnson',
        department: 'Physics',
        purpose: 'Presentation of research findings by postgraduate students',
        status: 'pending'
      }
    ];
  }
  
  // User management
  showAddUserModal() {
    console.log('Show add user modal');
    
    // Create and present the modal
    this.presentAddUserModal();
  }

  async presentAddUserModal(userData?: any) {
    const modal = await this.modalController.create({
      component: AddUserComponent,
      componentProps: {
        user: userData,
        currentUserRole: 'Admin' // Always 'Admin' in the admin dashboard
      },
      cssClass: 'user-modal'
    });
    
    // Present the modal
    await modal.present();
    
    // Handle the modal result
    const { data } = await modal.onDidDismiss();
    
    if (data) {
      console.log('User data returned:', data);
      
      if (userData) {
        // Editing existing user
        this.handleExistingUserUpdate(userData, data);
      } else {
        // Adding new HOD
        this.handleNewHodCreation(data);
      }
    }
  }

  // Handle existing user update
  private handleExistingUserUpdate(userData: any, updatedData: User) {
    const index = this.users.findIndex(u => u.id === userData.id);
    if (index !== -1) {
      this.users[index] = {
        id: Number(updatedData.id), // Convert string id to number
        title: updatedData.title,
        name: updatedData.name,
        email: updatedData.contact.email, // Use email from contact object
        role: updatedData.role,
        department: updatedData.department,
        avatar: this.users[index].avatar || 'assets/default-avatar.png'
      };
      this.presentToast('User updated successfully');
      
      // In a real app, you would also update the auth account and staff record
      // For demo purposes, we'll just log this
      console.log('Would update auth account and staff record for:', updatedData.id);
    }
  }

  // Handle new HOD creation
  private handleNewHodCreation(hodData: User) {
    console.log('Starting new HOD creation process:', hodData);
    
    // Check data validity before proceeding
    if (!hodData.contact?.email) {
      this.presentToast('Error: Email is required for creating an account');
      return;
    }
    
    // Show loading state
    this.isSubmitting = true;
    
    // First check if email already exists
    this.authService.checkEmailExists(hodData.contact.email).subscribe({
      next: exists => {
        if (exists) {
          this.presentToast(`Email ${hodData.contact.email} is already in use. Please use a different email.`);
          this.isSubmitting = false;
          return;
        }
        
        // 1. Create the authentication account with a secure password
        const defaultPassword = this.authService.generateDefaultPassword();
        console.log('Generated default password:', defaultPassword);
        
        this.authService.createUserAccount(hodData.contact.email, 'HOD', defaultPassword).subscribe({
          next: authResult => {
            if (authResult.success) {
              console.log('Auth account created successfully, now creating staff record');
              
              // 2. Then add to staff collection
              this.staffService.addStaffMember(hodData).subscribe({
                next: staffResult => {
                  if (staffResult.success) {
                    console.log('Staff record created successfully');
                    
                    // Reload HODs from database to ensure list is up-to-date
                    this.loadHODs();
                    
                    // Show success message with password info
                    this.presentHodCreationSuccess(hodData, defaultPassword);
                  } else {
                    console.error('Staff record creation failed:', staffResult.message);
                    this.presentToast(`Error creating staff record: ${staffResult.message}`);
                  }
                  this.isSubmitting = false;
                },
                error: error => {
                  console.error('Error in staff service:', error);
                  this.presentToast('Error adding staff record: ' + (error.message || 'Unknown error'));
                  this.isSubmitting = false;
                }
              });
            } else {
              console.error('Auth creation failed:', authResult.message);
              this.presentToast(`Auth account error: ${authResult.message}`);
              this.isSubmitting = false;
            }
          },
          error: error => {
            console.error('Error in auth service:', error);
            this.presentToast('Error creating authentication account: ' + (error.message || 'Unknown error'));
            this.isSubmitting = false;
          }
        });
      },
      error: error => {
        console.error('Error checking email existence:', error);
        this.presentToast('Error checking if email exists: ' + (error.message || 'Unknown error'));
        this.isSubmitting = false;
      }
    });
  }

  editUser(user: any) {
    console.log('Editing user:', user);
    this.presentAddUserModal(user);
  }
  
  // Department management
  async showAddDepartmentModal() {
    const modal = await this.modalController.create({
      component: AddDepartmentComponent,
      componentProps: {
        department: null,
        currentUserRole: 'Admin'
      },
      cssClass: 'department-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.department) {
      this.handleDepartmentCreation(data.department);
    }
  }

  async editDepartment(department: Department) {
    const modal = await this.modalController.create({
      component: AddDepartmentComponent,
      componentProps: {
        department: department,
        currentUserRole: 'Admin'
      },
      cssClass: 'department-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.department) {
      this.handleDepartmentUpdate(department.id!, data.department);
    }
  }

  async deleteDepartment(department: Department) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${department.name}"? This action cannot be undone and will affect all related data.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: () => {
            this.performDepartmentDeletion(department.id!);
          }
        }
      ]
    });

    await alert.present();
  }

  private handleDepartmentCreation(departmentData: Department) {
    this.isSubmitting = true;
    
    this.departmentService.addDepartment(departmentData).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department created successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to create department: ' + result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error creating department:', error);
        this.presentToast('Error creating department: ' + (error.message || 'Unknown error'));
      }
    });
  }

  private handleDepartmentUpdate(id: string, departmentData: Department) {
    this.isSubmitting = true;
    
    this.departmentService.updateDepartment(id, departmentData).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department updated successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to update department: ' + result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error updating department:', error);
        this.presentToast('Error updating department: ' + (error.message || 'Unknown error'));
      }
    });
  }

  private performDepartmentDeletion(id: string) {
    this.isSubmitting = true;
    
    this.departmentService.deleteDepartment(id).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department deleted successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to delete department: ' + result.message);
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error deleting department:', error);
        this.presentToast('Error deleting department: ' + (error.message || 'Unknown error'));
      }
    });
  }
  
  // Venue management
  async showAddVenueModal() {
    this.presentAddVenueModal();
  }
  
  editVenue(venue: VenueDisplayInfo) {
    console.log('Editing venue:', venue);
    this.presentAddVenueModal(venue);
  }

  async presentAddVenueModal(venueData?: VenueDisplayInfo) {
    const modal = await this.modalController.create({
      component: AddVenueComponent,
      componentProps: {
        venue: venueData,
        isEditMode: !!venueData
      },
      cssClass: 'add-venue-modal'
    });
    
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.venue) {
      if (venueData) {
        // Update existing venue
        this.handleVenueUpdate(venueData.id, data.venue);
      } else {
        // Add new venue
        this.handleVenueCreation(data.venue);
      }
    }
  }

  private handleVenueCreation(venueData: any) {
    // Handle the new venue (e.g., add to this.venues)
    this.venues.push(venueData);
    this.presentToast('Venue added successfully');
    this.loadVenues(); // Reload to get updated data
  }

  private handleVenueUpdate(venueId: string, venueData: any) {
    this.venueService.updateVenue(venueId, venueData).subscribe({
      next: (result) => {
        if (result.success) {
          this.presentToast('Venue updated successfully');
          this.loadVenues(); // Reload venues
        } else {
          this.presentToast('Failed to update venue: ' + result.message);
        }
      },
      error: (error) => {
        this.presentToast('Error updating venue: ' + error.message);
      }
    });
  }

  // Add method to delete venue
  async deleteVenue(venue: VenueDisplayInfo) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete venue "${venue.name}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.venueService.deleteVenue(venue.id).subscribe({
              next: (result) => {
                if (result.success) {
                  this.presentToast('Venue deleted successfully');
                  this.loadVenues(); // Reload venues
                } else {
                  this.presentToast('Failed to delete venue: ' + result.message);
                }
              },
              error: (error) => {
                this.presentToast('Error deleting venue: ' + error.message);
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }
  
  // Settings management
  saveSettings() {
    console.log('Saving settings');
  }
  
  // Backup management
  createBackup() {
    console.log('Creating backup');
  }
  
  restoreBackup(backup: any) {
    console.log('Restoring backup:', backup);
  }
  
  downloadBackup(backup: any) {
    console.log('Downloading backup:', backup);
  }
  
  saveBackupSettings() {
    console.log('Saving backup settings');
  }
  
  // Toggle sidebar visibility
  toggleSidebar() {
    console.log('Admin toggleSidebar called, current state:', this.sidebarVisible);
    this.sidebarService.toggleSidebar();
    
    // Alternative approach with direct toggle for immediate feedback
    // this.sidebarVisible = !this.sidebarVisible;
    // this.cdr.detectChanges();
    // this.sidebarService.sidebarVisibleSubject.next(this.sidebarVisible);
  }

  // Reports section methods
  reportViewChanged() {
    console.log('Report view changed to:', this.reportView);
    this.loadReportData();
  }
  
  loadReportData() {
    console.log('Loading report data for range:', this.reportDateRange);
    this.isLoadingReport = true;
    
    // Simulate API call to fetch report data
    setTimeout(() => {
      if (this.reportView === 'department' && this.selectedDepartmentForReport !== 'all') {
        this.loadDepartmentReport();
      }
      this.isLoadingReport = false;
    }, 1000);
  }
  
  generateReport() {
    this.isLoadingReport = true;
    
    // Simulate report generation process
    setTimeout(() => {
      this.presentToast('Report generated successfully');
      this.isLoadingReport = false;
    }, 1500);
  }
  
  exportReport() {
    // Simulate export process
    this.presentToast('Report exported successfully');
  }
  
  applyVenueFilters() {
    console.log('Applying venue filters:', this.venueReportFilter);
    // In a real app, this would filter the venue data based on building and type
  }
  
  loadDepartmentReport() {
    console.log('Loading department report for:', this.selectedDepartmentForReport);
    this.isLoadingReport = true;
    
    // Simulate API call to fetch department-specific data
    setTimeout(() => {
      if (this.selectedDepartmentForReport !== 'all') {
        // For demo purposes, we'll populate with mock lecturer data for CS department
        if (this.selectedDepartmentForReport === 1) { // Computer Science
          this.departmentLecturerStats = [
            { name: 'Dr. John Smith', avatar: 'assets/avatar1.png', weeklyHours: 18, moduleCount: 4, workloadPercentage: 0.75 },
            { name: 'Dr. Sarah Johnson', avatar: 'assets/avatar3.png', weeklyHours: 20, moduleCount: 5, workloadPercentage: 0.83 },
            { name: 'Prof. Michael Davis', avatar: null, weeklyHours: 22, moduleCount: 6, workloadPercentage: 0.92 },
            { name: 'Dr. Robert Brown', avatar: 'assets/avatar2.png', weeklyHours: 12, moduleCount: 3, workloadPercentage: 0.5 }
          ];
        } else if (this.selectedDepartmentForReport === 2) { // Engineering
          this.departmentLecturerStats = [
            { name: 'Dr. Emily Taylor', avatar: 'assets/avatar4.png', weeklyHours: 14, moduleCount: 3, workloadPercentage: 0.58 },
            { name: 'Prof. James Wilson', avatar: null, weeklyHours: 16, moduleCount: 4, workloadPercentage: 0.67 }
          ];
        } else {
          this.departmentLecturerStats = [];
        }
      } else {
        this.departmentLecturerStats = [];
      }
      
      this.isLoadingReport = false;
    }, 1000);
  }
  
  getWorkloadClass(percentage: number): string {
    if (percentage < 0.5) return 'low';
    if (percentage < 0.75) return 'medium';
    if (percentage > 0.9) return 'high';
    return 'optimal';
  }
  
  getUtilizationClass(percentage: number): string {
    if (percentage < 30) return 'low';
    if (percentage < 60) return 'medium';
    if (percentage > 85) return 'high';
    return 'optimal';
  }
  
  getHotspotIcon(type: string): string {
    switch (type) {
      case 'venue': return 'business';
      case 'lecturer': return 'person';
      case 'time': return 'time';
      case 'department': return 'school';
      default: return 'alert-circle';
    }
  }

  private async presentHodCreationSuccess(hodData: User, defaultPassword: string) {
    // In a real app, you might want to show this in a modal instead of a toast
    this.presentToast(
      `HOD account created successfully!\nEmail: ${hodData.contact?.email}\nTemporary Password: ${defaultPassword}\nPlease ensure to communicate these credentials securely.`
    );
  }
}
  // private async presentHodCreationSuccess(hodData: User, defaultPassword: string) {
  //   // In a real app, you might want to show this in a modal instead of a toast
  //   this.presentToast(
  //     `HOD account created successfully!\nEmail: ${hodData.contact?.email}\nTemporary Password: ${defaultPassword}\nPlease ensure to communicate these credentials securely.`
  //   );
  // }

