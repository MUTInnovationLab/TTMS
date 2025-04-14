import { Component, OnInit, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

export interface TimetableSession {
  id: number;
  title: string;
  module: string;
  moduleCode: string;
  lecturer: string;
  venue: string;
  group: string;
  day: number;
  startSlot: number;
  endSlot: number;
  category: string;
  color: string;
  departmentId?: number;
  hasConflict?: boolean;
}

export enum ConflictType {
  VENUE = 'Venue Conflict',
  LECTURER = 'Lecturer Conflict',
  GROUP = 'Student Group Conflict',
  EQUIPMENT = 'Equipment Conflict'
}

export interface ConflictResolution {
  id: number;
  type: string;
  action: 'changeVenue' | 'changeTime' | 'splitGroup' | 'cancel';
  newVenue?: string;
  newDay?: number;
  newStartSlot?: number;
  newEndSlot?: number;
}

export interface Conflict {
  id: number;
  type: ConflictType;
  priority: 'high' | 'medium' | 'low';
  sessions: TimetableSession[];
  details: string;
  possibleResolutions: ConflictResolution[];
  selected?: ConflictResolution;
  resolved: boolean;
}

@Component({
  selector: 'app-conflict-res',
  templateUrl: './conflict-res.component.html',
  styleUrls: ['./conflict-res.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ConflictResComponent implements OnInit {
  @Input() conflicts: Conflict[] = [];
  @Output() resolveConflict = new EventEmitter<{ conflict: Conflict, resolution: ConflictResolution }>();
  
  selectedConflict: Conflict | null = null;
  viewMode: 'list' | 'comparison' = 'list';
  
  // Time slots (8am to 9pm)
  timeSlots = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    time: `${i + 8}:00`
  }));
  
  // Days of the week
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Alternative venues
  alternativeVenues = [
    'Room A101', 'Room A102', 'Room B201', 'Room B202', 
    'Room C301', 'Room C302', 'Conference Room 1', 'Conference Room 2'
  ];

  constructor() { }

  ngOnInit() {
    if (this.conflicts.length === 0) {
      this.generateMockData();
    }
    
    if (this.conflicts.length > 0) {
      this.selectedConflict = this.conflicts[0];
    }
  }
  
  selectConflict(conflict: Conflict) {
    this.selectedConflict = conflict;
  }
  
  getFilteredConflicts(resolved: boolean) {
    return this.conflicts.filter(c => c.resolved === resolved);
  }
  
  getAffectedResources(conflict: Conflict): string {
    const resources: string[] = [];
    
    // Find common elements across sessions
    if (conflict.type === ConflictType.VENUE) {
      resources.push(conflict.sessions[0].venue);
    } else if (conflict.type === ConflictType.LECTURER) {
      resources.push(conflict.sessions[0].lecturer);
    } else if (conflict.type === ConflictType.GROUP) {
      resources.push(conflict.sessions[0].group);
    }
    
    return resources.join(', ');
  }
  
  selectResolution(conflict: Conflict, resolution: ConflictResolution) {
    conflict.selected = resolution;
  }
  
  applyResolution(conflict: Conflict) {
    if (!conflict.selected) return;
    
    this.resolveConflict.emit({
      conflict: conflict,
      resolution: conflict.selected
    });
    
    // For demo purposes, mark as resolved
    conflict.resolved = true;
    this.selectedConflict = null;
  }
  
  autoResolve() {
    // Auto-select first resolution for each conflict
    this.conflicts.forEach(conflict => {
      if (!conflict.resolved && conflict.possibleResolutions.length > 0) {
        conflict.selected = conflict.possibleResolutions[0];
        this.applyResolution(conflict);
      }
    });
  }
  
  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'comparison' : 'list';
  }
  
  getConflictTypeIcon(type: ConflictType): string {
    switch (type) {
      case ConflictType.VENUE:
        return 'business';
      case ConflictType.LECTURER:
        return 'person';
      case ConflictType.GROUP:
        return 'people';
      case ConflictType.EQUIPMENT:
        return 'hardware-chip';
      default:
        return 'alert-circle';
    }
  }
  
  getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'medium';
    }
  }
  
  getModifiedSession(session: TimetableSession, resolution: ConflictResolution): TimetableSession {
    const modified = {...session};
    
    if (resolution.action === 'changeVenue' && resolution.newVenue) {
      modified.venue = resolution.newVenue;
    }
    
    if (resolution.action === 'changeTime') {
      if (resolution.newDay !== undefined) modified.day = resolution.newDay;
      if (resolution.newStartSlot !== undefined) modified.startSlot = resolution.newStartSlot;
      if (resolution.newEndSlot !== undefined) modified.endSlot = resolution.newEndSlot;
    }
    
    return modified;
  }
  
  getResolutionSummary(resolution: ConflictResolution): string {
    switch (resolution.action) {
      case 'changeVenue':
        return `Change venue to ${resolution.newVenue}`;
      case 'changeTime':
        const day = resolution.newDay !== undefined ? this.days[resolution.newDay] : '';
        const start = resolution.newStartSlot !== undefined ? this.timeSlots[resolution.newStartSlot].time : '';
        return `Reschedule to ${day} ${start}`;
      case 'splitGroup':
        return 'Split student group into two sessions';
      case 'cancel':
        return 'Cancel the session';
      default:
        return 'Unknown resolution';
    }
  }
  
  private generateMockData() {
    const session1: TimetableSession = {
      id: 1,
      title: 'Introduction to Programming',
      module: 'Computer Science Fundamentals',
      moduleCode: 'CSC1001',
      lecturer: 'Dr. Smith',
      venue: 'Room A101',
      group: 'CS Year 1',
      day: 1,
      startSlot: 2,
      endSlot: 4,
      category: 'Lecture',
      color: '#4c8dff'
    };
    
    const session2: TimetableSession = {
      id: 2,
      title: 'Database Systems',
      module: 'Database Fundamentals',
      moduleCode: 'CSC2002',
      lecturer: 'Dr. Smith',
      venue: 'Room B201',
      group: 'CS Year 2',
      day: 1,
      startSlot: 3,
      endSlot: 5,
      category: 'Lecture',
      color: '#4c8dff'
    };
    
    const session3: TimetableSession = {
      id: 3,
      title: 'Web Development',
      module: 'Web Technologies',
      moduleCode: 'CSC2003',
      lecturer: 'Prof. Johnson',
      venue: 'Room A101',
      group: 'CS Year 2',
      day: 2,
      startSlot: 6,
      endSlot: 8,
      category: 'Lab',
      color: '#ffc409'
    };
    
    const session4: TimetableSession = {
      id: 4,
      title: 'Mobile App Development',
      module: 'Mobile Technologies',
      moduleCode: 'CSC3001',
      lecturer: 'Prof. Williams',
      venue: 'Room C301',
      group: 'CS Year 3',
      day: 2,
      startSlot: 6,
      endSlot: 8,
      category: 'Lab',
      color: '#ffc409'
    };
    
    this.conflicts = [
      {
        id: 1,
        type: ConflictType.LECTURER,
        priority: 'high',
        sessions: [session1, session2],
        details: 'Dr. Smith is scheduled for two different lectures at overlapping times',
        possibleResolutions: [
          {
            id: 1,
            type: 'Reschedule',
            action: 'changeTime',
            newDay: 2,
            newStartSlot: 2,
            newEndSlot: 4
          },
          {
            id: 2,
            type: 'Reassign',
            action: 'changeVenue',
            newVenue: 'Room C302'
          }
        ],
        resolved: false
      },
      {
        id: 2,
        type: ConflictType.VENUE,
        priority: 'medium',
        sessions: [session3, session4],
        details: 'Room A101 is double-booked for Web Development and Mobile App Development',
        possibleResolutions: [
          {
            id: 3,
            type: 'Relocate',
            action: 'changeVenue',
            newVenue: 'Room B202'
          },
          {
            id: 4,
            type: 'Reschedule',
            action: 'changeTime',
            newDay: 3,
            newStartSlot: 6,
            newEndSlot: 8
          }
        ],
        resolved: false
      },
      {
        id: 3,
        type: ConflictType.GROUP,
        priority: 'low',
        sessions: [
          {
            id: 5,
            title: 'Database Lab',
            module: 'Database Fundamentals',
            moduleCode: 'CSC2002',
            lecturer: 'Dr. Brown',
            venue: 'Room C301',
            group: 'CS Year 2',
            day: 4,
            startSlot: 4,
            endSlot: 6,
            category: 'Lab',
            color: '#ffc409'
          },
          {
            id: 6,
            title: 'Software Engineering',
            module: 'Software Development',
            moduleCode: 'CSC2001',
            lecturer: 'Prof. Davis',
            venue: 'Room A102',
            group: 'CS Year 2',
            day: 4,
            startSlot: 5,
            endSlot: 7,
            category: 'Lecture',
            color: '#4c8dff'
          }
        ],
        details: 'CS Year 2 has overlapping Database Lab and Software Engineering sessions',
        possibleResolutions: [
          {
            id: 5,
            type: 'Reschedule',
            action: 'changeTime',
            newDay: 3,
            newStartSlot: 4,
            newEndSlot: 6
          },
          {
            id: 6,
            type: 'Split Group',
            action: 'splitGroup'
          }
        ],
        resolved: false
      }
    ];
  }

  // Add helper method to access ConflictType in the template
  getVenueConflictType(): ConflictType {
    return ConflictType.VENUE;
  }

  getLecturerConflictType(): ConflictType {
    return ConflictType.LECTURER;
  }
  
  getGroupConflictType(): ConflictType {
    return ConflictType.GROUP;
  }
  
  getEquipmentConflictType(): ConflictType {
    return ConflictType.EQUIPMENT;
  }

  // Add this helper method for use in the template
  getDayIndex(day: number | undefined): number {
    if (day === undefined) return 0;
    return Number(day);
  }
}
