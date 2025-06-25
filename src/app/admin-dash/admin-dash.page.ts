import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { Conflict, ConflictType, ConflictResolution } from '../components/conflict-res/conflict-res.component';
import { SidebarService } from '../services/Utility Services/sidebar.service';
import { Subscription } from 'rxjs';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

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
    { id: 1, name: 'John Smith', email: 'john.smith@example.com', role: 'HOD', avatar: 'assets/avatar1.png' },
    { id: 2, name: 'Jane Doe', email: 'jane.doe@example.com', role: 'Lecturer', avatar: 'assets/avatar2.png' },
    { id: 3, name: 'Robert Johnson', email: 'robert.j@example.com', role: 'Admin', avatar: 'assets/avatar3.png' }
  ];
  
  // Department management
  departments = [
    { id: 1, name: 'Computer Science', hod: 'Dr. John Smith', moduleCount: 12 },
    { id: 2, name: 'Engineering', hod: 'Dr. Emily Brown', moduleCount: 15 },
    { id: 3, name: 'Business Studies', hod: 'Prof. Michael Davis', moduleCount: 10 }
  ];
  
  // Venue management
  venues = [
    { id: 1, name: 'Room A101', type: 'Classroom', capacity: 40, equipment: ['Projector', 'Whiteboard'] },
    { id: 2, name: 'Lab L201', type: 'Laboratory', capacity: 30, equipment: ['Computers', 'Projector'] },
    { id: 3, name: 'Hall H301', type: 'Lecture Hall', capacity: 120, equipment: ['Sound System', 'Projector', 'Smart Board'] }
  ];
  
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
  
  venueUtilizationStats = [
    { id: 1, name: 'Room A101', type: 'Classroom', capacity: 40, utilizationRate: 85 },
    { id: 2, name: 'Lab L201', type: 'Laboratory', capacity: 30, utilizationRate: 62 },
    { id: 3, name: 'Hall H301', type: 'Lecture Hall', capacity: 120, utilizationRate: 45 },
    { id: 4, name: 'Room B102', type: 'Classroom', capacity: 35, utilizationRate: 78 },
    { id: 5, name: 'Lab L105', type: 'Laboratory', capacity: 25, utilizationRate: 92 },
    { id: 6, name: 'Room C204', type: 'Classroom', capacity: 30, utilizationRate: 34 }
  ];
  
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

  constructor(
     private alertController: AlertController,
  private router: Router,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef
  ) { 
    console.log('AdminDashPage constructor');
  }

  ngOnInit() {
    console.log('AdminDashPage ngOnInit');
    
    // Initialize dashboard
    this.generateMockTimetableData();
    
    // Initialize venue conflicts and special requests
    this.generateMockVenueConflicts();
    this.generateMockSpecialEventRequests();

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
    
    this.venueConflicts = [
      {
        id: 1,
        venue: this.venues[0], // Room A101
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
        venue: this.venues[2], // Hall H301
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
    
    this.specialEventRequests = [
      {
        id: 1,
        title: 'Tech Conference',
        venue: this.venues[2], // Hall H301
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
        venue: this.venues[1], // Lab L201
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
  }
  
  editUser(user: any) {
    console.log('Editing user:', user);
  }
  
  // Department management
  showAddDepartmentModal() {
    console.log('Show add department modal');
  }
  
  editDepartment(department: any) {
    console.log('Editing department:', department);
  }
  
  // Venue management
  showAddVenueModal() {
    console.log('Show add venue modal');
  }
  
  editVenue(venue: any) {
    console.log('Editing venue:', venue);
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
