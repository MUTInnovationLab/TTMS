import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { Conflict, ConflictType, ConflictResolution } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { AddUserComponent, User } from '../components/add-user/add-user.component';
import { AddVenueComponent } from '../components/add-venue/add-venue.component';
import { AuthService } from '../services/Authentication Services/auth.service';
import { StaffService } from '../services/Data Services/staff.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { VenueService, VenueDisplayInfo } from '../services/Entity Management Services/venue.service';

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
  sidebarVisible = false;
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
    conflicts: 3
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
  departments = [
    { id: 1, name: 'Computer Science', hod: 'Dr. John Smith', moduleCount: 12 },
    { id: 2, name: 'Engineering', hod: 'Dr. Emily Brown', moduleCount: 15 },
    { id: 3, name: 'Business Studies', hod: 'Prof. Michael Davis', moduleCount: 10 }
  ];
  
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

  constructor(
    private alertController: AlertController,
    private router: Router,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private authService: AuthService,
    private staffService: StaffService,
    private venueService: VenueService
  ) { 
    console.log('AdminDashPage constructor');
  }

  ngOnInit() {
    console.log('AdminDashPage ngOnInit');
    
    // Initialize dashboard
    this.generateMockTimetableData();
    this.loadVenues(); // Load venues from database
    
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
  }
  
  publishTimetable() {
    console.log('Publishing timetable');
  }
  
  resolveConflicts() {
    console.log('Resolving conflicts');
    this.activeSection = 'timetable';
    this.timetableView = 'conflicts';
  }
  
  loadDepartmentSubmission() {
    if (this.selectedDepartment) {
      console.log('Loading submission for department ID:', this.selectedDepartment);
      
      // In a real application, you would fetch this data from a service
      // For now, we'll filter our mock data based on department ID
      this.departmentSubmissionSessions = this.masterTimetableSessions
        .filter(session => session.departmentId === this.selectedDepartment)
        .map(session => ({...session})); // Create a new copy of the sessions
      
      // Generate conflicts specifically for this department's submission
      this.generateDepartmentSubmissionConflicts();
    }
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
    if (this.selectedDepartment) {
      // Check if there are any unresolved conflicts
      if (this.departmentSubmissionConflicts.length > 0) {
        this.presentToast('Cannot approve submission with unresolved conflicts');
        this.showDepartmentSubmissionConflicts(); // Show the conflicts
        return;
      }
      
      console.log('Approving submission for department ID:', this.selectedDepartment);
      // In a real application, you would make an API call to approve the submission
      this.presentToast('Department submission approved successfully');
      
      // Add to master timetable (in a real app, this might be a separate step)
      this.departmentSubmissionSessions.forEach(session => {
        // Find if the session already exists in the master timetable
        const existingIndex = this.masterTimetableSessions.findIndex(s => s.id === session.id);
        
        if (existingIndex >= 0) {
          // Update existing session
          this.masterTimetableSessions[existingIndex] = { ...session };
        } else {
          // Add new session
          this.masterTimetableSessions.push({ ...session });
        }
      });
    }
  }
  
  rejectDepartmentSubmission() {
    if (this.selectedDepartment) {
      console.log('Rejecting submission for department ID:', this.selectedDepartment);
      // Show prompt for rejection reason
      this.promptForRejectionReason();
    }
  }
  
  promptForRejectionReason() {
    // This would normally show a modal or alert to enter rejection reason
    console.log('Prompting for rejection reason');
    // After getting reason, you would send it along with the rejection
  }
  
  presentToast(message: string) {
    // This would normally show a toast notification
    console.log('TOAST:', message);
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
  showAddDepartmentModal() {
    console.log('Show add department modal');
  }
  
  editDepartment(department: any) {
    console.log('Editing department:', department);
  }
  
  // Venue management
  async showAddVenueModal() {
    const modal = await this.modalController.create({
      component: AddVenueComponent, // Replace with your actual component
      cssClass: 'add-venue-modal'
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.venue) {
      // Handle the new venue (e.g., add to this.venues)
      this.venues.push(data.venue);
      this.presentToast('Venue added successfully');
    }
  }
  
  editVenue(venue: VenueDisplayInfo) {
    console.log('Editing venue:', venue);
    // Open venue edit modal with venue data
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

