import { Component, OnInit, ChangeDetectorRef, OnDestroy, Injector } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { Conflict, ConflictType, ConflictResolution } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription, combineLatest, interval } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { AddUserComponent, User } from '../components/add-user/add-user.component';
import { AddVenueComponent } from '../components/add-venue/add-venue.component';
// Import AddDepartmentComponent for modal usage
import { AddDepartmentComponent } from '../components/add-department/add-department.component';
import type { Department } from '../interfaces/department.interface';
import { AuthService } from '../services/Authentication Services/auth.service';
import { StaffService } from '../services/Data Services/staff.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';
import { DepartmentService } from '../services/Entity Management Services/department.service';
import { TimetableDatabaseService, TimetableDocument } from '../services/Timetable Core Services/timetable-database.service';
import { ToastController } from '@ionic/angular';
import { Firestore, collection, collectionData, query, where, onSnapshot, doc } from '@angular/fire/firestore';
import { startWith, switchMap } from 'rxjs/operators';

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

// Interface for real-time stats
interface RealTimeStats {
  departments: number;
  venues: number;
  sessions: number;
  conflicts: number;
  submissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  activeUsers: number;
  lastUpdated: Date;
}

// Interface for department submission status
interface DepartmentSubmissionStatus {
  id: string;
  departmentName: string;
  status: 'not-started' | 'in-progress' | 'submitted' | 'approved' | 'rejected';
  lastModified: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  sessionsCount: number;
  conflictsCount: number;
  hodName?: string;
  hodEmail?: string;
  progress: number; // 0-100 percentage
  feedback?: string;
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
  
  // Dashboard stats - will be updated with real-time data
  stats: RealTimeStats = {
    departments: 0,
    venues: 0,
    sessions: 0,
    conflicts: 0,
    submissions: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    activeUsers: 0,
    lastUpdated: new Date()
  };

  // Department submission statuses
  departmentSubmissionStatuses: DepartmentSubmissionStatus[] = [];
  
  // Real-time subscriptions
  private statsSubscription?: Subscription;
  private submissionStatusSubscription?: Subscription;
  
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
  users: User[] = [];
  
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
    private toastController: ToastController,
    private firestore: Firestore
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
    
    // Initialize dashboard with real data only
    this.loadVenues(); // Load venues from database
    this.loadDepartments(); // Load departments from database
    this.loadSubmittedTimetables(); // Load submitted timetables from database

    // Initialize real-time stats and department submission tracking
    this.initializeRealTimeStats();
    this.initializeDepartmentSubmissionTracking();

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

    // Always load HODs on init so the table is populated on first load
    this.loadHODs();

    // Use changeSection to trigger loading for the initial active section
    this.changeSection(this.activeSection);
  }

  // Load departments from database
  loadDepartments() {
    console.log('Loading departments from database');
    this.departmentsLoading = true;
    
    this.departmentService.getAllDepartments().subscribe({
      next: (departments: Department[]) => {
        console.log('Departments loaded successfully:', departments);
        this.departments = departments;
        this.departmentsLoading = false;
        
        // Update stats
        this.stats.departments = departments.length;
        
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading departments:', error);
        this.presentToast('Failed to load departments: ' + (error.message || 'Unknown error'));
        this.departmentsLoading = false;
      }
    });
  }

  // Load HODs from Firebase
  loadHODs() {
    console.log('Loading HODs from Staff collection');
    this.staffService.getAllHODs().subscribe({
      next: (hods) => {
        console.log('Loaded HODs:', hods);
        this.users = hods.map(hod => ({
          id: String(hod.id),
          title: hod.title || '',
          name: hod.name || '',
          contact: { email: hod.contact?.email || '' },
          role: hod.role || 'HOD',
          department: hod.department || ''
        }));
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading HODs:', error);
        this.presentToast('Failed to load HODs: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // Initialize real-time stats tracking
  private initializeRealTimeStats() {
    console.log('Initializing real-time stats tracking');
    
    // Combine multiple observables to get real-time stats
    this.statsSubscription = combineLatest([
      this.getDepartmentCount(),
      this.getVenueCount(),
      this.getSessionCount(),
      this.getConflictCount(),
      this.getSubmissionCounts(),
      this.getActiveUserCount()
    ]).subscribe({
      next: ([departments, venues, sessions, conflicts, submissions, activeUsers]) => {
        this.stats = {
          departments,
          venues,
          sessions,
          conflicts,
          submissions: submissions.total,
          pendingSubmissions: submissions.pending,
          approvedSubmissions: submissions.approved,
          rejectedSubmissions: submissions.rejected,
          activeUsers,
          lastUpdated: new Date()
        };
        
        console.log('Real-time stats updated:', this.stats);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating real-time stats:', error);
      }
    });
  }

  // Initialize department submission status tracking
  private initializeDepartmentSubmissionTracking() {
    console.log('Initializing department submission tracking');
    
    this.submissionStatusSubscription = this.getDepartmentSubmissionStatuses().subscribe({
      next: (statuses) => {
        this.departmentSubmissionStatuses = statuses;
        console.log('Department submission statuses updated:', statuses);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error tracking department submissions:', error);
      }
    });
  }

  // Get department count from Firestore
  private getDepartmentCount() {
    const departmentsCollection = collection(this.firestore, 'departments');
    return collectionData(departmentsCollection).pipe(
      startWith([]),
      switchMap(departments => [departments.length])
    );
  }

  // Get venue count from Firestore
  private getVenueCount() {
    const venuesCollection = collection(this.firestore, 'venues');
    return collectionData(venuesCollection).pipe(
      startWith([]),
      switchMap(venues => [venues.length])
    );
  }

  // Get session count from all timetables
  private getSessionCount() {
    const timetablesCollection = collection(this.firestore, 'timetables');
    return collectionData(timetablesCollection).pipe(
      startWith([]),
      switchMap(timetables => {
        let totalSessions = 0;
        timetables.forEach((timetable: any) => {
          if (timetable.sessions && Array.isArray(timetable.sessions)) {
            totalSessions += timetable.sessions.length;
          }
        });
        return [totalSessions];
      })
    );
  }

  // Get conflict count from all timetables
  private getConflictCount() {
    const timetablesCollection = collection(this.firestore, 'timetables');
    return collectionData(timetablesCollection).pipe(
      startWith([]),
      switchMap(timetables => {
        let totalConflicts = 0;
        timetables.forEach((timetable: any) => {
          if (timetable.conflicts) {
            totalConflicts += timetable.conflicts;
          } else if (timetable.sessions && Array.isArray(timetable.sessions)) {
            // Count sessions with conflicts
            totalConflicts += timetable.sessions.filter((s: any) => s.hasConflict).length;
          }
        });
        return [totalConflicts];
      })
    );
  }

  // Get submission counts by status
  private getSubmissionCounts() {
    const timetablesCollection = collection(this.firestore, 'timetables');
    return collectionData(timetablesCollection).pipe(
      startWith([]),
      switchMap(timetables => {
        const counts = {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0
        };
        
        timetables.forEach((timetable: any) => {
          if (timetable.status === 'submitted' || timetable.status === 'approved' || timetable.status === 'rejected' || timetable.status === 'pending') {
            counts.total++;
            
            switch (timetable.status) {
              case 'pending':
              case 'submitted':
                counts.pending++;
                break;
              case 'approved':
                counts.approved++;
                break;
              case 'rejected':
                counts.rejected++;
                break;
            }
          }
        });
        
        return [counts];
      })
    );
  }

  // Get active user count from authentication collection
  private getActiveUserCount() {
    const usersCollection = collection(this.firestore, 'users');
    return collectionData(usersCollection).pipe(
      startWith([]),
      switchMap(users => {
        // Count users who have logged in within the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const activeUsers = users.filter((user: any) => {
          if (user.lastLoginAt) {
            const lastLogin = user.lastLoginAt.toDate ? user.lastLoginAt.toDate() : new Date(user.lastLoginAt);
            return lastLogin > thirtyDaysAgo;
          }
          return false;
        });
        
        return [activeUsers.length];
      })
    );
  }

  // Get department submission statuses
  private getDepartmentSubmissionStatuses() {
    return combineLatest([
      this.getDepartments(),
      this.getTimetables()
    ]).pipe(
      switchMap(([departments, timetables]) => {
        const statuses: DepartmentSubmissionStatus[] = departments.map((dept: any) => {
          // Find the latest timetable for this department
          const deptTimetables = timetables.filter((t: any) => t.department === dept.name);
          const latestTimetable = deptTimetables
            .sort((a: any, b: any) => {
              const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
              const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
              return dateB.getTime() - dateA.getTime();
            })[0];

          let status: DepartmentSubmissionStatus['status'] = 'not-started';
          let lastModified = new Date();
          let submittedAt: Date | undefined;
          let reviewedAt: Date | undefined;
          let sessionsCount = 0;
          let conflictsCount = 0;
          let progress = 0;
          let feedback: string | undefined;

          if (latestTimetable) {
            status = this.mapTimetableStatus(latestTimetable['status']);
            lastModified = latestTimetable['updatedAt']?.toDate ? latestTimetable['updatedAt'].toDate() : new Date(latestTimetable['updatedAt']);
            
            if (latestTimetable['submittedAt']) {
              submittedAt = latestTimetable['submittedAt'].toDate ? latestTimetable['submittedAt'].toDate() : new Date(latestTimetable['submittedAt']);
            }
            
            if (latestTimetable['reviewedAt']) {
              reviewedAt = latestTimetable['reviewedAt'].toDate ? latestTimetable['reviewedAt'].toDate() : new Date(latestTimetable['reviewedAt']);
            }
            
            if (latestTimetable['sessions']) {
              sessionsCount = latestTimetable['sessions'].length;
              conflictsCount = latestTimetable['sessions'].filter((s: any) => s.hasConflict).length;
            }
            
            progress = this.calculateProgress(latestTimetable);
            feedback = latestTimetable['adminFeedback'] || latestTimetable['feedback'];
          }

          return {
            id: dept.id,
            departmentName: dept.name,
            status,
            lastModified,
            submittedAt,
            reviewedAt,
            sessionsCount,
            conflictsCount,
            progress,
            feedback,
            hodName: dept.hodName,
            hodEmail: dept.hodEmail
          } as DepartmentSubmissionStatus;
        });

        return [statuses];
      })
    );
  }

  // Helper method to get departments
  private getDepartments() {
    const departmentsCollection = collection(this.firestore, 'departments');
    return collectionData(departmentsCollection, { idField: 'id' });
  }

  // Helper method to get timetables
  private getTimetables() {
    const timetablesCollection = collection(this.firestore, 'timetables');
    return collectionData(timetablesCollection, { idField: 'id' });
  }

  // Map timetable status to submission status
  private mapTimetableStatus(timetableStatus: string): DepartmentSubmissionStatus['status'] {
    switch (timetableStatus) {
      case 'draft':
      case 'in-progress':
        return 'in-progress';
      case 'pending':
      case 'submitted':
        return 'submitted';
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      default:
        return 'not-started';
    }
  }

  // Calculate progress percentage for a timetable
  private calculateProgress(timetable: any): number {
    if (!timetable) return 0;
    
    let progress = 0;
    
    // Base progress for having sessions
    if (timetable['sessions'] && timetable['sessions'].length > 0) {
      progress += 40; // 40% for having sessions
      
      // Additional progress based on session completeness
      const completeSessions = timetable['sessions'].filter((s: any) => 
        s.moduleName && s.lecturer && s.venue && s.group
      );
      
      if (completeSessions.length === timetable['sessions'].length) {
        progress += 30; // 30% for all sessions being complete
      } else {
        progress += Math.floor((completeSessions.length / timetable['sessions'].length) * 30);
      }
      
      // Progress for having no conflicts
      const conflictingSessions = timetable['sessions'].filter((s: any) => s.hasConflict);
      if (conflictingSessions.length === 0) {
        progress += 20; // 20% for no conflicts
      }
      
      // Progress for submission
      if (timetable['status'] === 'submitted' || timetable['status'] === 'approved') {
        progress += 10; // 10% for submission
      }
    }
    
    return Math.min(progress, 100);
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
    // Clean up subscriptions
    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
    
    if (this.statsSubscription) {
      this.statsSubscription.unsubscribe();
    }
    
    if (this.submissionStatusSubscription) {
      this.submissionStatusSubscription.unsubscribe();
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
    if (section === 'users') {
      // Always reload HODs when switching to User Management
      this.loadHODs();
    }
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
    
    // Load submitted timetables when switching to submissions view
    if (this.timetableView === 'submissions') {
      console.log('Loading submitted timetables for submissions view');
      this.loadSubmittedTimetables();
    }
    
    // Load real conflict data when switching to conflicts view
    if (this.timetableView === 'conflicts') {
      this.loadRealConflictData();
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
        console.log('Timetables raw data:', JSON.stringify(timetables, null, 2));
        
        // Filter for submitted, approved, rejected, or pending timetables
        this.submittedTimetables = timetables.filter(t => 
          t.status === 'submitted' || t.status === 'approved' || t.status === 'rejected' || t.status === 'pending'
        );
        
        console.log('Filtered submitted timetables:', this.submittedTimetables);
        console.log('Submitted timetables count:', this.submittedTimetables.length);
        
        // Update dashboard stats
        this.stats.submissions = this.submittedTimetables.filter(t => 
          t.status === 'submitted' || t.status === 'approved' || t.status === 'rejected' || t.status === 'pending'
        ).length;
        
        console.log('Submitted timetables final:', this.submittedTimetables);
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
  
  // Temporary method to create test data
  async createTestTimetableSubmission() {
    console.log('Creating test timetable submission');
    
    try {
      // First create a basic timetable
      const result = await this.timetableDatabaseService.createNewTimetable(
        'Computer Science',
        'Test Timetable 2025',
        '2025-2026',
        1
      ).toPromise();
      
      if (result?.success && result.timetableId) {
        console.log('Created timetable with ID:', result.timetableId);
        
        // Add some test sessions to the timetable
        const testSessions = [
          {
            id: 1,
            moduleId: 1,
            moduleName: 'Data Structures',
            lecturerId: 1,
            lecturer: 'Dr. John Smith',
            venueId: '1',
            venue: 'Lab A',
            groupId: 1,
            group: 'CS3A',
            day: 'Monday',
            timeSlot: '09:15 - 09:55',
            category: 'Lecture',
            color: '#4285f4',
            hasConflict: false,
            departmentId: 1
          },
          {
            id: 2,
            moduleId: 2,
            moduleName: 'Database Systems',
            lecturerId: 2,
            lecturer: 'Dr. Jane Doe',
            venueId: '2',
            venue: 'Room B1',
            groupId: 1,
            group: 'CS3A',
            day: 'Wednesday',
            timeSlot: '11:00 - 11:40',
            category: 'Lecture',
            color: '#ff6b6b',
            hasConflict: false,
            departmentId: 1
          }
        ];
        
        // Save the timetable with sessions
        const saveResult = await this.timetableDatabaseService.saveTimetable({
          sessions: testSessions
        }, result.timetableId).toPromise();
        
        if (saveResult?.success) {
          console.log('Sessions added to timetable');
          
          // Now submit the timetable
          const submitResult = await this.timetableDatabaseService.submitTimetable(result.timetableId).toPromise();
          
          if (submitResult?.success) {
            this.presentToast('Test timetable submission created successfully');
            this.loadSubmittedTimetables(); // Reload the list
          } else {
            this.presentToast('Failed to submit test timetable');
          }
        } else {
          this.presentToast('Failed to add sessions to test timetable');
        }
      } else {
        this.presentToast('Failed to create test timetable');
      }
    } catch (error) {
      console.error('Error creating test timetable:', error);
      this.presentToast('Error creating test timetable');
    }
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
    // Convert day number to grid day number (sessions are stored with 0-6, grid expects 0-6)
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
    const slotNumber = timeSlotMap[dbSession.timeSlot] ?? 0;

    // Determine day value - if it's already a number, use it; if it's a string, convert it
    let dayValue = 0;
    if (typeof dbSession.day === 'number') {
      dayValue = dbSession.day;
    } else if (typeof dbSession.day === 'string') {
      dayValue = dayMap[dbSession.day] ?? 0;
    }

    return {
      id: dbSession.id,
      title: dbSession.moduleName || 'Unknown Module',
      module: dbSession.moduleName || 'Unknown Module',
      moduleCode: `MOD${dbSession.moduleId}`,
      lecturer: dbSession.lecturer || 'Unknown Lecturer',
      venue: dbSession.venue || 'Unknown Venue',
      group: dbSession.group || 'Unknown Group',
      day: dayValue,
      startSlot: slotNumber,
      endSlot: slotNumber + 1,  // Single slot sessions
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
  getTimetableStatusColor(status: string): string {
    switch (status) {
      case 'pending':
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

  getTimetableStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
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
    console.log('Timetable sessions:', timetable.sessions);
    this.selectedSubmittedTimetable = timetable;
    this.selectedDepartmentName = timetable.department;
    
    // Load the timetable sessions for review
    this.departmentSubmissionSessions = timetable.sessions.map(session => {
      console.log('Converting session:', session);
      const converted = this.convertDatabaseSessionToGridSession(session);
      console.log('Converted to:', converted);
      return converted;
    });
    
    console.log('Final department submission sessions:', this.departmentSubmissionSessions);
    
    // Generate conflicts for this submission
    this.generateDepartmentSubmissionConflicts();
    
    // Reset conflict resolution view
    this.showingDeptConflictRes = false;
    
    // Force change detection
    this.cdr.detectChanges();
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
      this.loadRealConflictData();
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
  
  // Real data loading methods
  private loadRealConflictData() {
    // Load conflicts from database instead of generating mock data
    console.log('Loading real conflict data from database');
    
    // Reset conflicts
    this.conflictSessions = [];
    this.conflictSummary = [];
    this.formattedConflicts = [];
    
    // Get conflicts from real timetable data
    this.detectConflictsFromRealData();
  }
  
  private detectConflictsFromRealData() {
    // This method will detect conflicts from actual submitted timetables
    // Instead of using static mock data
    
    if (this.submittedTimetables && this.submittedTimetables.length > 0) {
      const allSessions: TimetableSession[] = [];
      
      // Collect all sessions from submitted timetables
      this.submittedTimetables.forEach(timetable => {
        if (timetable.sessions) {
          const convertedSessions = timetable.sessions.map(session => 
            this.convertDatabaseSessionToGridSession(session)
          );
          allSessions.push(...convertedSessions);
        }
      });
      
      // Detect conflicts between sessions
      this.detectConflictsBetweenSessions(allSessions);
    }
  }
  
  private detectConflictsBetweenSessions(sessions: TimetableSession[]) {
    const conflicts: Conflict[] = [];
    const conflictSessions: TimetableSession[] = [];
    
    // Check for venue and time conflicts
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const session1 = sessions[i];
        const session2 = sessions[j];
        
        // Check if sessions overlap in time and day
        if (session1.day === session2.day && 
            this.timeSlotOverlaps(session1, session2)) {
          
          // Venue conflict
          if (session1.venue === session2.venue) {
            conflicts.push({
              id: conflicts.length + 1,
              type: ConflictType.VENUE,
              priority: 'high',
              sessions: [session1, session2],
              details: `Venue conflict: ${session1.venue} is double-booked`,
              possibleResolutions: [
                {
                  id: 1,
                  type: 'Relocate',
                  action: 'changeVenue',
                  newVenue: 'Alternative Venue'
                },
                {
                  id: 2,
                  type: 'Reschedule',
                  action: 'changeTime',
                  newDay: session1.day,
                  newStartSlot: session1.endSlot,
                  newEndSlot: session1.endSlot + (session1.endSlot - session1.startSlot)
                }
              ],
              resolved: false
            });
            
            // Mark sessions as having conflicts
            session1.hasConflict = true;
            session2.hasConflict = true;
            conflictSessions.push(session1, session2);
          }
          
          // Lecturer conflict
          if (session1.lecturer === session2.lecturer) {
            conflicts.push({
              id: conflicts.length + 1,
              type: ConflictType.LECTURER,
              priority: 'medium',
              sessions: [session1, session2],
              details: `Lecturer conflict: ${session1.lecturer} is scheduled for multiple sessions`,
              possibleResolutions: [
                {
                  id: 3,
                  type: 'Reschedule',
                  action: 'changeTime',
                  newDay: session1.day + 1,
                  newStartSlot: session1.startSlot,
                  newEndSlot: session1.endSlot
                }
              ],
              resolved: false
            });
            
            // Mark sessions as having conflicts
            session1.hasConflict = true;
            session2.hasConflict = true;
            conflictSessions.push(session1, session2);
          }
        }
      }
    }
    
    this.formattedConflicts = conflicts;
    this.conflictSessions = Array.from(new Set(conflictSessions)); // Remove duplicates
    this.stats.conflicts = conflicts.length;
    
    // Update conflict summary
    this.conflictSummary = conflicts.map(conflict => ({
      id: conflict.id,
      type: conflict.type === ConflictType.VENUE ? 'Venue Conflict' : 'Lecturer Conflict',
      description: conflict.details,
      sessions: conflict.sessions.map(s => s.id)
    }));
  }
  
  private timeSlotOverlaps(session1: TimetableSession, session2: TimetableSession): boolean {
    return !(session1.endSlot <= session2.startSlot || session2.endSlot <= session1.startSlot);
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
    this.loadRealConflictData();
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
        // Prevent navigation by only reloading HOD list and closing modal
        this.handleNewHodCreation(data);
      }
    }
  }

  // Handle existing user update
  private handleExistingUserUpdate(userData: any, updatedData: User) {
    const index = this.users.findIndex(u => u.id === userData.id);
    if (index !== -1) {
      this.users[index] = {
        id: String(updatedData.id), // Convert id to string to match User interface
        title: updatedData.title,
        name: updatedData.name,
        contact: updatedData.contact, // Use contact object instead of email property
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
    
    // Add safeguard to prevent navigation after adding a new user
    const originalNavigate = this.router.navigate;
    this.router.navigate = (...args: any[]) => {
      console.log('Navigation prevented during new HOD creation:', args);
      return Promise.resolve(false);
    };
    
    // First check if email already exists
    this.authService.checkEmailExists(hodData.contact.email).subscribe({
      next: exists => {
        if (exists) {
          this.presentToast(`Email ${hodData.contact.email} is already in use. Please use a different email.`);
          this.isSubmitting = false;
      
          // Restore original navigation
          this.router.navigate = originalNavigate;
          return;
        }
        
        // 1. Create the authentication account with a secure password
        const defaultPassword = 'def@Pass#01';
        console.log('Using fixed default password:', defaultPassword);

        // Assume admin credentials are stored securely in environment or service
        const adminEmail = 'admin@example.com'; // TODO: Replace with actual admin email retrieval
        const adminPassword = 'adminPassword123'; // TODO: Replace with actual admin password retrieval
        
        this.authService.createUserAccount(hodData.contact.email, 'HOD', defaultPassword, adminEmail, adminPassword).subscribe({
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
                  
                  // Restore original navigation
                  this.router.navigate = originalNavigate;
                },
                error: error => {
                  console.error('Error in staff service:', error);
                  this.presentToast('Error adding staff record: ' + (error.message || 'Unknown error'));
                  this.isSubmitting = false;
                  
                  // Restore original navigation
                  this.router.navigate = originalNavigate;
                }
              });
            } else {
              console.error('Auth creation failed:', authResult.message);
              this.presentToast(`Auth account error: ${authResult.message}`);
              this.isSubmitting = false;
              
              // Restore original navigation
              this.router.navigate = originalNavigate;
            }
          },
          error: error => {
            console.error('Error in auth service:', error);
            this.presentToast('Error creating authentication account: ' + (error.message || 'Unknown error'));
            this.isSubmitting = false;
            
            // Restore original navigation
            this.router.navigate = originalNavigate;
          }
        });
      },
      error: error => {
        console.error('Error checking email existence:', error);
        this.presentToast('Error checking if email exists: ' + (error.message || 'Unknown error'));
        this.isSubmitting = false;
        
        // Restore original navigation
        this.router.navigate = originalNavigate;
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
      next: (result: any) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department created successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to create department: ' + result.message);
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        console.error('Error creating department:', error);
        this.presentToast('Error creating department: ' + (error.message || 'Unknown error'));
      }
    });
  }

  private handleDepartmentUpdate(id: string, departmentData: Department) {
    this.isSubmitting = true;
    
    this.departmentService.updateDepartment(id, departmentData).subscribe({
      next: (result: any) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department updated successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to update department: ' + result.message);
        }
      },
      error: (error: any) => {
        this.isSubmitting = false;
        console.error('Error updating department:', error);
        this.presentToast('Error updating department: ' + (error.message || 'Unknown error'));
      }
    });
  }

  private performDepartmentDeletion(id: string) {
    this.isSubmitting = true;
    
    this.departmentService.deleteDepartment(id).subscribe({
      next: (result: any) => {
        this.isSubmitting = false;
        if (result.success) {
          this.presentToast('Department deleted successfully');
          this.loadDepartments(); // Reload departments
        } else {
          this.presentToast('Failed to delete department: ' + result.message);
        }
      },
      error: (error: any) => {
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

  // Helper methods for department submission status
  getDepartmentStatusColor(status: DepartmentSubmissionStatus['status']): string {
    switch (status) {
      case 'approved':
        return 'success';
      case 'submitted':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'in-progress':
        return 'primary';
      default:
        return 'medium';
    }
  }

  getDepartmentStatusIcon(status: DepartmentSubmissionStatus['status']): string {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'submitted':
        return 'time';
      case 'rejected':
        return 'close-circle';
      case 'in-progress':
        return 'create';
      default:
        return 'document-text';
    }
  }

  getDepartmentStatusText(status: DepartmentSubmissionStatus['status']): string {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'submitted':
        return 'Pending Review';
      case 'rejected':
        return 'Rejected';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  }

  getDepartmentStatusLabel(status: DepartmentSubmissionStatus['status']): string {
    return this.getDepartmentStatusText(status);
  }

  // Get departments with submission issues (conflicts or overdue)
  getDepartmentsWithIssues(): DepartmentSubmissionStatus[] {
    return this.departmentSubmissionStatuses.filter(dept => 
      dept.conflictsCount > 0 || this.isDepartmentOverdue(dept)
    );
  }

  // Get departments that need attention (rejected or with conflicts)
  getDepartmentsNeedingAttention(): DepartmentSubmissionStatus[] {
    return this.departmentSubmissionStatuses.filter(dept => 
      dept.status === 'rejected' || dept.conflictsCount > 0
    );
  }

  // Get submission rate percentage
  getSubmissionRate(): number {
    if (this.departmentSubmissionStatuses.length === 0) return 0;
    
    const submittedOrApproved = this.departmentSubmissionStatuses.filter(dept => 
      dept.status === 'submitted' || dept.status === 'approved'
    );
    
    return Math.round((submittedOrApproved.length / this.departmentSubmissionStatuses.length) * 100);
  }

  // Check if department submission is overdue
  isDepartmentOverdue(dept: DepartmentSubmissionStatus): boolean {
    const daysSinceLastModified = Math.floor(
      (new Date().getTime() - dept.lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Consider overdue if no activity for 7 days and status is in-progress
    return dept.status === 'in-progress' && daysSinceLastModified > 7;
  }

  // Get progress color based on percentage
  getProgressColor(progress: number): string {
    if (progress >= 80) return 'success';
    if (progress >= 50) return 'warning';
    if (progress >= 25) return 'primary';
    return 'danger';
  }

  // Send reminder to HOD
  async sendReminderToHOD(dept: DepartmentSubmissionStatus) {
    if (!dept.hodEmail) {
      this.presentToast('HOD email not available for ' + dept.departmentName);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Send Reminder',
      message: `Send a reminder to ${dept.hodName || 'HOD'} of ${dept.departmentName} about their timetable submission?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send Reminder',
          handler: () => {
            // In a real implementation, this would send an email
            console.log('Sending reminder to:', dept.hodEmail);
            this.presentToast(`Reminder sent to ${dept.departmentName} HOD`);
            
            // Add activity to recent activities
            this.recentActivities.unshift({
              type: 'primary',
              icon: 'mail',
              message: `Reminder sent to ${dept.departmentName} about timetable submission`,
              timestamp: new Date()
            });
            
            // Keep only recent activities
            if (this.recentActivities.length > 10) {
              this.recentActivities = this.recentActivities.slice(0, 10);
            }
            
            this.cdr.detectChanges();
          }
        }
      ]
    });

    await alert.present();
  }

  // View department details
  viewDepartmentDetails(dept: DepartmentSubmissionStatus) {
    console.log('Viewing department details:', dept);
    
    // Find the submitted timetable for this department
    const deptTimetable = this.submittedTimetables.find(t => t.department === dept.departmentName);
    
    if (deptTimetable) {
      this.selectTimetableForReview(deptTimetable);
      this.activeSection = 'timetable';
      this.timetableView = 'submissions';
    } else {
      this.presentToast(`No submitted timetable found for ${dept.departmentName}`);
    }
  }

  // Refresh real-time stats manually
  refreshStats() {
    console.log('Manually refreshing stats...');
    
    // Re-initialize the subscriptions to get fresh data
    if (this.statsSubscription) {
      this.statsSubscription.unsubscribe();
    }
    
    if (this.submissionStatusSubscription) {
      this.submissionStatusSubscription.unsubscribe();
    }
    
    this.initializeRealTimeStats();
    this.initializeDepartmentSubmissionTracking();
    
    this.presentToast('Stats refreshed successfully');
  }

  // Format time ago
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  // Force refresh of real-time data
  refreshRealTimeData() {
    console.log('Manually refreshing real-time data');
    this.stats.lastUpdated = new Date();
    
    // Trigger change detection to update the UI
    this.cdr.detectChanges();
    
    this.presentToast('Dashboard data refreshed');
  }

  // Prompt department for submission
  promptDepartmentSubmission(department: DepartmentSubmissionStatus) {
    console.log('Prompting department for submission:', department);
    
    // In a real implementation, this would send a notification/email to the HOD
    this.presentToast(`Reminder sent to ${department.departmentName}`);
  }

  private async presentHodCreationSuccess(hodData: User, defaultPassword: string) {
    // In a real app, you might want to show this in a modal instead of a toast
    this.presentToast(
      `HOD account created successfully!\nEmail: ${hodData.contact?.email}\nTemporary Password: ${defaultPassword}\nPlease ensure to communicate these credentials securely.`
    );
  }
}

