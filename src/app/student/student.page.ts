import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { SidebarService } from '../services/sidebar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-student',
  templateUrl: './student.page.html',
  styleUrls: ['./student.page.scss'],
  standalone: false,
})
export class StudentPage implements OnInit, OnDestroy {
  // Navigation and section control
  currentSection: string = 'timetable';
  showProfileDropdown: boolean = false;
  sidebarVisible = false;
  private sidebarSubscription?: Subscription;
  
  // Timetable section
  timetableView: string = 'calendar';
  
  // Student timetable sessions
  studentSessions: TimetableSession[] = [];
  selectedSession: TimetableSession | null = null;

  constructor(
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Initialization code
    this.loadStudentTimetable();
    
    // Set initial sidebar state
    this.sidebarVisible = this.sidebarService.isSidebarVisible;
    
    // Subscribe to sidebar state
    this.sidebarSubscription = this.sidebarService.sidebarVisible$.subscribe(
      state => {
        console.log('Student sidebar state changed:', state);
        this.sidebarVisible = state;
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

  // Toggle profile dropdown
  toggleProfileDropdown() {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  // Change main section
  changeSection(section: string) {
    this.currentSection = section;
    if (window.innerWidth < 768) { // Hide on mobile after selection
      this.sidebarService.hideSidebar();
    }
  }

  // Handle session click in the timetable
  handleSessionClick(session: TimetableSession) {
    this.selectedSession = session;
    // In read-only mode, just display session details
    console.log('Session selected:', session);
  }

  toggleSidebar() {
    console.log('Student toggleSidebar called');
    this.sidebarService.toggleSidebar();
    // For direct feedback
    // this.sidebarVisible = !this.sidebarVisible;
    // this.cdr.detectChanges();
  }

  // Load the student's timetable data
  private loadStudentTimetable() {
    // This would typically come from a service that fetches the student's enrolled sessions
    this.studentSessions = [
      {
        id: 1,
        title: 'Introduction to Programming',
        module: 'Introduction to Programming',
        moduleCode: 'CS101',
        lecturer: 'Dr. Smith',
        venue: 'CS Lab 1',
        group: 'CS Year 1',
        day: 0, // Monday
        startSlot: 2, // 10am
        endSlot: 4, // 12pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 1
      },
      {
        id: 2,
        title: 'Calculus II',
        module: 'Calculus II',
        moduleCode: 'MATH201',
        lecturer: 'Dr. Johnson',
        venue: 'Lecture Hall 3',
        group: 'CS Year 1',
        day: 1, // Tuesday
        startSlot: 6, // 2pm
        endSlot: 8, // 4pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 2
      },
      {
        id: 3,
        title: 'Academic Writing',
        module: 'Academic Writing',
        moduleCode: 'ENG101',
        lecturer: 'Prof. Williams',
        venue: 'Humanities Building 2',
        group: 'CS Year 1',
        day: 3, // Thursday
        startSlot: 1, // 9am
        endSlot: 3, // 11am
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 3
      },
      {
        id: 4,
        title: 'Programming Workshop',
        module: 'Introduction to Programming',
        moduleCode: 'CS101',
        lecturer: 'Jane Cooper',
        venue: 'Room 201',
        group: 'CS Year 1',
        day: 2, // Wednesday
        startSlot: 6, // 2pm
        endSlot: 7, // 3pm
        category: 'Tutorial',
        color: '#2dd36f',
        departmentId: 1
      },
      {
        id: 5,
        title: 'Calculus Problem Session',
        module: 'Calculus II',
        moduleCode: 'MATH201',
        lecturer: 'Robert Chen',
        venue: 'Math Lab',
        group: 'CS Year 1',
        day: 4, // Friday
        startSlot: 3, // 11am
        endSlot: 5, // 1pm
        category: 'Tutorial',
        color: '#2dd36f',
        departmentId: 2
      }
    ];
  }
}
