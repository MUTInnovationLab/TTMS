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
  @Output() sessionDelete = new EventEmitter<TimetableSession>();

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

  // Drag and drop state
  draggedSession: TimetableSession | null = null;
  isDragging = false;
  showDeleteZone = false;
  dragOverDeleteZone = false;
  
  // Grid state
  highlightedCell: { day: number, slot: number } | null = null;

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
    if (!this.isDragging) {
      this.sessionClick.emit(session);
    }
  }

  onDragStart(event: DragEvent, session: TimetableSession) {
    if (!event.dataTransfer) return;
    
    this.draggedSession = session;
    this.isDragging = true;
    this.showDeleteZone = true;
    
    // Set drag data
    event.dataTransfer.setData('sessionId', session.id.toString());
    event.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image
    this.createDragPreview(event, session);
    
    console.log('Drag started for session:', session.title);
  }

  onDragEnd(event: DragEvent) {
    // Clean up drag state
    this.draggedSession = null;
    this.isDragging = false;
    this.showDeleteZone = false;
    this.dragOverDeleteZone = false;
    this.highlightedCell = null;
    
    console.log('Drag ended');
  }

  onDrop(event: DragEvent, day: number, slot: number) {
    event.preventDefault();
    event.stopPropagation();
    
    const sessionId = event.dataTransfer?.getData('sessionId');
    if (!sessionId) return;
    
    const session = this.sessions.find(s => s.id === +sessionId);
    if (!session) return;

    // Check if dropping in the same position
    if (session.day === day && session.startSlot === slot) {
      console.log('Session dropped in same position');
      return;
    }

    // Check for conflicts
    if (this.hasConflict(session, day, slot)) {
      console.log('Cannot drop session due to conflict');
      // You could show a toast or alert here
      return;
    }

    console.log(`Dropping session ${session.title} to day ${day}, slot ${slot}`);
    
    this.sessionDrop.emit({
      session,
      day,
      startSlot: slot
    });
    
    // Clear highlighting
    this.highlightedCell = null;
  }

  onDragOver(event: DragEvent, day: number, slot: number) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    
    // Highlight the cell being dragged over
    this.highlightedCell = { day, slot };
  }

  onDragLeave(event: DragEvent) {
    // Only clear highlighting if we're leaving the entire grid area
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      this.highlightedCell = null;
    }
  }

  // Delete zone handlers
  onDeleteZoneDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverDeleteZone = true;
  }

  onDeleteZoneDragLeave(event: DragEvent) {
    this.dragOverDeleteZone = false;
  }

  onDeleteZoneDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const sessionId = event.dataTransfer?.getData('sessionId');
    if (!sessionId) return;
    
    const session = this.sessions.find(s => s.id === +sessionId);
    if (!session) return;

    console.log('Deleting session:', session.title);
    this.sessionDelete.emit(session);
    
    // Clean up drag state
    this.dragOverDeleteZone = false;
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  // Helper methods
  private createDragPreview(event: DragEvent, session: TimetableSession) {
    // Create a custom drag preview element
    const dragPreview = document.createElement('div');
    dragPreview.className = 'drag-preview';
    dragPreview.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      background: ${session.color};
      color: white;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    `;
    dragPreview.innerHTML = `
      <strong>${session.title}</strong><br>
      ${session.venue} • ${session.lecturer}
    `;
    
    document.body.appendChild(dragPreview);
    
    // Set the custom drag image
    event.dataTransfer?.setDragImage(dragPreview, 75, 25);
    
    // Clean up the preview element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 0);
  }

  private hasConflict(session: TimetableSession, targetDay: number, targetSlot: number): boolean {
    const sessionDuration = session.endSlot - session.startSlot;
    const targetEndSlot = targetSlot + sessionDuration;
    
    return this.sessions.some(existingSession => {
      if (existingSession.id === session.id) return false; // Skip the session being moved
      
      return existingSession.day === targetDay &&
             ((targetSlot >= existingSession.startSlot && targetSlot < existingSession.endSlot) ||
              (targetEndSlot > existingSession.startSlot && targetEndSlot <= existingSession.endSlot) ||
              (targetSlot <= existingSession.startSlot && targetEndSlot >= existingSession.endSlot));
    });
  }

  isCellHighlighted(day: number, slot: number): boolean {
    return this.highlightedCell?.day === day && this.highlightedCell?.slot === slot;
  }

  isCellInConflict(day: number, slot: number): boolean {
    if (!this.draggedSession) return false;
    
    const sessionDuration = this.draggedSession.endSlot - this.draggedSession.startSlot;
    return this.highlightedCell?.day === day && 
           this.highlightedCell?.slot === slot && 
           this.hasConflict(this.draggedSession, day, slot);
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
