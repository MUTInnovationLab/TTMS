import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { TimetableSession } from '../components/timetable-grid/timetable-grid.component';
import { Venue, Booking } from '../components/venue-avail/venue-avail.component';
import { SidebarService } from '../services/sidebar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lecturer',
  templateUrl: './lecturer.page.html',
  styleUrls: ['./lecturer.page.scss'],
  standalone: false // Explicitly set to false to clarify it's not standalone
})
export class LecturerPage implements OnInit, OnDestroy {
  // Navigation and section control
  currentSection: string = 'timetable';
  showProfileDropdown: boolean = false;
  sidebarVisible: boolean = false;
  private sidebarSubscription?: Subscription;
  
  // Timetable section
  timetableView: string = 'calendar';
  
  // Venue section
  venueView: string = 'available';
  availableVenues: Venue[] = [];
  
  // Time slots for booking form
  timeSlots = [
    { id: 0, time: '08:00' },
    { id: 1, time: '09:00' },
    { id: 2, time: '10:00' },
    { id: 3, time: '11:00' },
    { id: 4, time: '12:00' },
    { id: 5, time: '13:00' },
    { id: 6, time: '14:00' },
    { id: 7, time: '15:00' },
    { id: 8, time: '16:00' },
    { id: 9, time: '17:00' },
    { id: 10, time: '18:00' }
  ];
  
  // Booking form data
  bookingForm = {
    venueId: 0,
    date: new Date().toISOString(),
    startSlot: 0,
    endSlot: 0,
    purpose: '',
    notes: ''
  };
  
  // Module timetable view
  selectedModuleForTimetable: string | null = null;
  
  // Timetable data
  lecturerSessions: TimetableSession[] = [];
  modulesSessions: { [moduleId: string]: TimetableSession[] } = {};

  constructor(
    private alertController: AlertController,
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef
  ) { 
    console.log('LecturerPage constructor');
  }

  ngOnInit() {
    console.log('LecturerPage ngOnInit');
    
    // Initialize timetable data
    this.generateMockTimetableData();
    
    // Initialize venue data
    this.initializeVenueData();
    
    // Set initial sidebar state
    this.sidebarVisible = this.sidebarService.isSidebarVisible;
    console.log('Initial sidebar state:', this.sidebarVisible);
    
    // Subscribe to sidebar state
    this.sidebarSubscription = this.sidebarService.sidebarVisible$.subscribe(
      state => {
        console.log('Lecturer sidebar state changed:', state);
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

  // Toggle profile dropdown
  toggleProfileDropdown() {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  // Change main section
  changeSection(section: string) {
    this.currentSection = section;
  }
  
  // Change venue view
  changeVenueView(view: string) {
    this.venueView = view;
  }
  
  // Handle session click from timetable
  async onSessionClick(session: TimetableSession) {
    const alert = await this.alertController.create({
      header: session.title,
      subHeader: `${session.moduleCode}`,
      message: `
        <p><strong>Venue:</strong> ${session.venue}</p>
        <p><strong>Group:</strong> ${session.group}</p>
        <p><strong>Time:</strong> ${this.getSessionTime(session)}</p>
      `,
      buttons: ['Close']
    });

    await alert.present();
  }
  
  // Handle session drop (for potential rescheduling - only enabled for admin)
  onSessionDropped(event: {session: TimetableSession, day: number, startSlot: number}) {
    // In lecturer view, we might want to just show a notification that rescheduling 
    // requires admin privileges or handle a rescheduling request
    console.log('Session drop detected:', event);
  }
  
  // View module timetable
  viewModuleTimetable(moduleId: string) {
    this.selectedModuleForTimetable = moduleId;
  }
  
  // Get sessions specific to a module
  getSessionsByModule(moduleId: string): TimetableSession[] {
    return this.modulesSessions[moduleId] || [];
  }
  
  // Handle venue booking requests from venue-avail component
  onVenueBookingRequest(bookingData: {venue: Venue, date: Date, startSlot?: number, endSlot?: number}) {
    console.log('Booking request received:', bookingData);
    
    // Populate the booking form with the selected venue and date
    this.bookingForm.venueId = bookingData.venue.id;
    this.bookingForm.date = bookingData.date.toISOString();
    
    // If time slots were selected, use them
    if (bookingData.startSlot !== undefined) {
      this.bookingForm.startSlot = bookingData.startSlot;
    }
    if (bookingData.endSlot !== undefined) {
      this.bookingForm.endSlot = bookingData.endSlot;
    }
    
    // Switch to the request form view
    this.venueView = 'request';
  }
  
  // Submit the booking request
  async submitBookingRequest() {
    // Validate form
    if (!this.bookingForm.venueId || !this.bookingForm.date || 
        this.bookingForm.startSlot >= this.bookingForm.endSlot || 
        !this.bookingForm.purpose) {
      
      const alert = await this.alertController.create({
        header: 'Invalid Request',
        message: 'Please fill in all required fields correctly.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }
    
    // Show confirmation
    const alert = await this.alertController.create({
      header: 'Booking Request Submitted',
      message: 'Your venue booking request has been submitted successfully.',
      buttons: [{
        text: 'OK',
        handler: () => {
          // Reset form and go to history view
          this.bookingForm = {
            venueId: 0,
            date: new Date().toISOString(),
            startSlot: 0,
            endSlot: 0,
            purpose: '',
            notes: ''
          };
          this.venueView = 'history';
        }
      }]
    });
    await alert.present();
  }
  
  // Toggle sidebar
  toggleSidebar() {
    console.log('Lecturer toggleSidebar called, current state:', this.sidebarVisible);
    this.sidebarService.toggleSidebar();
  }

  // Helper methods
  private getSessionTime(session: TimetableSession): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const day = days[session.day];
    const startHour = session.startSlot + 8; // Starting from 8:00
    const endHour = session.endSlot + 8;
    return `${day}, ${startHour}:00 - ${endHour}:00`;
  }
  
  // Initialize venue data
  private initializeVenueData() {
    this.availableVenues = [
      {
        id: 1,
        name: 'Room A101',
        building: 'Main Building',
        room: 'A101',
        type: 'Classroom',
        capacity: 40,
        equipment: ['Projector', 'Whiteboard'],
        image: 'assets/venue1.jpg',
        bookings: []
      },
      {
        id: 2,
        name: 'Lab L201',
        building: 'Science Block',
        room: 'L201',
        type: 'Laboratory',
        capacity: 30,
        equipment: ['Computer Workstations', 'Projector', 'Whiteboard'],
        image: 'assets/venue2.jpg',
        bookings: []
      },
      {
        id: 3,
        name: 'Hall H301',
        building: 'Conference Center',
        room: 'H301',
        type: 'Lecture Hall',
        capacity: 120,
        equipment: ['Audio System', 'Projector', 'Smart Board'],
        image: 'assets/venue3.jpg',
        bookings: []
      },
      {
        id: 4,
        name: 'Seminar Room S102',
        building: 'Business School',
        room: 'S102',
        type: 'Seminar Room',
        capacity: 50,
        equipment: ['Smart Board', 'Video Conferencing'],
        image: 'assets/venue4.jpg',
        bookings: []
      },
      {
        id: 5,
        name: 'Conference Room CR1',
        building: 'Administration',
        room: 'CR1',
        type: 'Conference Room',
        capacity: 25,
        equipment: ['Video Conferencing', 'Audio System', 'Whiteboard'],
        image: 'assets/venue5.jpg',
        bookings: []
      }
    ];
  }
  
  // Mock data generation
  private generateMockTimetableData() {
    // Lecturer's personal timetable
    this.lecturerSessions = [
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
        lecturer: 'Dr. Smith',
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
        lecturer: 'Dr. Smith',
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
        id: 7,
        title: 'Programming Fundamentals',
        module: 'Programming Fundamentals',
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
        id: 8,
        title: 'Data Structures',
        module: 'Data Structures',
        moduleCode: 'CS201',
        lecturer: 'Dr. Smith',
        venue: 'Lecture Hall 3',
        group: 'CS Year 2',
        day: 1, // Tuesday
        startSlot: 6, // 2pm
        endSlot: 8, // 4pm
        category: 'Lecture',
        color: '#4c8dff',
        departmentId: 1
      },
      {
        id: 9,
        title: 'Algorithm Design',
        module: 'Algorithm Design',
        moduleCode: 'CS301',
        lecturer: 'Dr. Smith',
        venue: 'CS Lab 2',
        group: 'CS Year 3',
        day: 3, // Thursday
        startSlot: 1, // 9am
        endSlot: 3, // 11am
        category: 'Lab',
        color: '#ffc409',
        departmentId: 1
      }
    ];
    
    // Module-specific timetables
    this.modulesSessions = {
      'module1': [
        {
          id: 7,
          title: 'Programming Fundamentals',
          module: 'Programming Fundamentals',
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
          id: 10,
          title: 'Programming Tutorial',
          module: 'Programming Fundamentals',
          moduleCode: 'CS101',
          lecturer: 'Dr. Smith',
          venue: 'Room 201',
          group: 'CS Year 1',
          day: 2, // Wednesday
          startSlot: 6, // 2pm
          endSlot: 7, // 3pm
          category: 'Tutorial',
          color: '#2dd36f',
          departmentId: 1
        }
      ],
      'module2': [
        {
          id: 8,
          title: 'Data Structures',
          module: 'Data Structures',
          moduleCode: 'CS201',
          lecturer: 'Dr. Smith',
          venue: 'Lecture Hall 3',
          group: 'CS Year 2',
          day: 1, // Tuesday
          startSlot: 6, // 2pm
          endSlot: 8, // 4pm
          category: 'Lecture',
          color: '#4c8dff',
          departmentId: 1
        },
        {
          id: 11,
          title: 'Data Structures Lab',
          module: 'Data Structures',
          moduleCode: 'CS201',
          lecturer: 'Dr. Smith',
          venue: 'CS Lab 2',
          group: 'CS Year 2',
          day: 4, // Friday
          startSlot: 3, // 11am
          endSlot: 5, // 1pm
          category: 'Lab',
          color: '#ffc409',
          departmentId: 1
        }
      ]
    };
  }
}
