import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

export interface TimeSlot {
  id: number;
  start: string;
  end: string;
}

export interface TimetableSession {
  id: number;
  title: string;
  module: string;
  moduleCode: string;
  lecturer: string;
  venue: string;
  group: string;
  day: number; // 0-6 for days of week
  startSlot: number;
  endSlot: number;
  category: string;
  color: string;
  departmentId: number;
  hasConflict?: boolean; // Optional property to indicate conflict
}

@Component({
  selector: 'app-timetable-grid',
  templateUrl: './timetable-grid.component.html',
  styleUrls: ['./timetable-grid.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class TimetableGridComponent implements OnInit {
  @Input() sessions: TimetableSession[] = [];
  @Output() sessionClick = new EventEmitter<TimetableSession>();
  @Output() sessionDrop = new EventEmitter<{session: TimetableSession, day: number, startSlot: number}>();

  // Date range
  startDate: Date = new Date();
  endDate: Date = new Date(new Date().setDate(new Date().getDate() + 6));

  // Filters
  viewFilters = {
    venue: '',
    lecturer: '',
    group: '',
    module: ''
  };

  // View options
  viewMode: 'day' | 'week' | 'month' = 'week';
  
  // Time slots (8am to 9pm)
  timeSlots: TimeSlot[] = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    start: `${i + 8}:00`,
    end: `${i + 9}:00`
  }));

  // Days of the week
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Session categories with colors
  categories = [
    { name: 'Lecture', color: '#4c8dff' },
    { name: 'Tutorial', color: '#2dd36f' },
    { name: 'Lab', color: '#ffc409' },
    { name: 'Exam', color: '#eb445a' },
    { name: 'Other', color: '#92949c' }
  ];

  constructor() { }

  ngOnInit() {
    // Initialize with mock data if none provided
    if (this.sessions.length === 0) {
      this.generateMockData();
    }
  }

  changeViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode = mode;
  }

  updateDateRange(event: any) {
    // Handle date range update
  }

  applyFilters() {
    // Apply selected filters
  }

  getFilteredSessions() {
    let filtered = [...this.sessions];
    
    if (this.viewFilters.venue) {
      filtered = filtered.filter(s => s.venue.includes(this.viewFilters.venue));
    }
    if (this.viewFilters.lecturer) {
      filtered = filtered.filter(s => s.lecturer.includes(this.viewFilters.lecturer));
    }
    if (this.viewFilters.group) {
      filtered = filtered.filter(s => s.group.includes(this.viewFilters.group));
    }
    if (this.viewFilters.module) {
      filtered = filtered.filter(s => s.module.includes(this.viewFilters.module) || 
                                     s.moduleCode.includes(this.viewFilters.module));
    }
    
    return filtered;
  }

  getSessionsForDayAndSlot(day: number, slot: number) {
    return this.getFilteredSessions().filter(
      s => s.day === day && slot >= s.startSlot && slot < s.endSlot
    );
  }

  isSlotStart(day: number, slot: number, session: TimetableSession) {
    return session.day === day && session.startSlot === slot;
  }

  handleSessionClick(session: TimetableSession) {
    this.sessionClick.emit(session);
  }

  onDragStart(event: DragEvent, session: TimetableSession) {
    event.dataTransfer?.setData('sessionId', session.id.toString());
  }

  onDrop(event: DragEvent, day: number, slot: number) {
    event.preventDefault();
    const sessionId = event.dataTransfer?.getData('sessionId');
    if (sessionId) {
      const session = this.sessions.find(s => s.id === +sessionId);
      if (session) {
        this.sessionDrop.emit({
          session,
          day,
          startSlot: slot
        });
      }
    }
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  private generateMockData() {
    this.sessions = [
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
}
