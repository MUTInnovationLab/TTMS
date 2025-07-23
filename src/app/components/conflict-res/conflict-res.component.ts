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
