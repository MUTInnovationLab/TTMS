import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

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

export interface SessionDropEvent {
  session: TimetableSession;
  day: number;
  startSlot: number;
  previousDay?: number;
  previousSlot?: number;
  isSnapped?: boolean;
}

@Component({
  selector: 'app-timetable-grid',
  templateUrl: './timetable-grid.component.html',
  styleUrls: ['./timetable-grid.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class TimetableGridComponent implements OnInit, OnChanges {
  @Input() sessions: TimetableSession[] = [];
  @Input() enableMagneticSnap: boolean = true;
  @Input() enableConflictPrevention: boolean = true;
  @Input() showDropPreview: boolean = true;
  @Output() sessionClick = new EventEmitter<TimetableSession>();
  @Output() sessionDrop = new EventEmitter<SessionDropEvent>();
  @Output() sessionDelete = new EventEmitter<TimetableSession>();

  // Track sessions to prevent duplication
  private sessionTracker = new Set<number>();

  // Date range
  startDate: Date = new Date();
  endDate: Date = new Date(new Date().setDate(new Date().getDate() + 6));

  // Filter options fetched from Firestore
  venues: string[] = [];
  modules: string[] = [];
  lecturers: string[] = [];
  groups: string[] = [];

  // Filters
  viewFilters = {
    venue: '',
    lecturer: '',
    group: '',
    module: ''
  };

  // View options
  viewMode: 'day' | 'week' | 'month' = 'week';
  
  // Time slots - University schedule
  timeSlots: TimeSlot[] = [
    { id: 0, start: '07:45', end: '08:25' },
    { id: 1, start: '09:15', end: '09:55' },
    { id: 2, start: '10:15', end: '10:55' },
    { id: 3, start: '11:00', end: '11:40' },
    { id: 4, start: '11:45', end: '12:25' },
    { id: 5, start: '13:05', end: '13:45' },
    { id: 6, start: '13:50', end: '14:30' },
    { id: 7, start: '14:35', end: '15:10' },
    { id: 8, start: '15:15', end: '16:00' }
  ];

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
  
  // Enhanced grid state
  highlightedCell: { day: number, slot: number } | null = null;
  previewDropZone: { day: number, slot: number, valid: boolean } | null = null;
  dragGhost: HTMLElement | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private firestore: Firestore
  ) { }

  async ngOnInit() {
    // No mock data generation - use only provided sessions
    await this.fetchFilterOptions();
    this.updateSessionTracker();
    console.log('TimetableGrid initialized with', this.sessions.length, 'sessions');
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update session tracker when sessions input changes
    if (changes['sessions']) {
      console.log('Sessions input changed:', {
        current: changes['sessions'].currentValue?.length || 0,
        previous: changes['sessions'].previousValue?.length || 0
      });
      this.updateSessionTracker();
      // Force change detection to update the view
      this.cdr.detectChanges();
    }
    console.log('Sessions updated:', this.sessions.length, 'unique sessions');
  }

  private async fetchFilterOptions() {
    try {
      // Fetch venues
      const venueSnapshot = await getDocs(collection(this.firestore, 'venues'));
      this.venues = venueSnapshot.docs.map(doc => doc.data()['name']).sort();

      // Fetch modules
      const moduleSnapshot = await getDocs(collection(this.firestore, 'modules'));
      this.modules = moduleSnapshot.docs.map(doc => doc.data()['name']).sort();

      // Fetch lecturers
      const lecturerSnapshot = await getDocs(collection(this.firestore, 'lecturers'));
      this.lecturers = lecturerSnapshot.docs.map(doc => doc.data()['name']).sort();

      // Fetch groups
      const groupSnapshot = await getDocs(collection(this.firestore, 'groups'));
      this.groups = groupSnapshot.docs.map(doc => doc.data()['name']).sort();

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }

  private updateSessionTracker() {
    this.sessionTracker.clear();
    // Remove duplicate sessions based on ID
    const uniqueSessions = this.sessions.reduce((acc, session) => {
      if (!acc.some(s => s.id === session.id)) {
        acc.push(session);
      }
      return acc;
    }, [] as TimetableSession[]);
    
    // Update the sessions array if duplicates were found
    if (uniqueSessions.length !== this.sessions.length) {
      console.warn(`Removed ${this.sessions.length - uniqueSessions.length} duplicate sessions`);
      this.sessions = uniqueSessions;
    }
    
    this.sessions.forEach(session => {
      this.sessionTracker.add(session.id);
    });
  }

  // Method to check if a session already exists to prevent duplication
  sessionExists(sessionId: number): boolean {
    return this.sessionTracker.has(sessionId);
  }

  // Validate session position
  isValidPosition(day: number, startSlot: number, endSlot: number): boolean {
    return day >= 0 && day < this.days.length && 
           startSlot >= 0 && endSlot <= this.timeSlots.length &&
           startSlot < endSlot;
  }

  // Get session display time
  getSessionTimeDisplay(session: TimetableSession): string {
    const startTime = this.timeSlots[session.startSlot]?.start || '??:??';
    const endTime = this.timeSlots[session.endSlot - 1]?.end || '??:??';
    return `${startTime} - ${endTime}`;
  }

  changeViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode = mode;
  }

  updateDateRange(event: any) {
    // Handle date range update
  }

  applyFilters() {
    // Apply selected filters
    this.cdr.detectChanges();
  }

  getFilteredSessions() {
    let filtered = [...this.sessions];

    if (this.viewFilters.venue) {
      filtered = filtered.filter(s => s.venue === this.viewFilters.venue);
    }
    if (this.viewFilters.lecturer) {
      filtered = filtered.filter(s => s.lecturer === this.viewFilters.lecturer);
    }
    if (this.viewFilters.group) {
      filtered = filtered.filter(s => s.group === this.viewFilters.group);
    }
    if (this.viewFilters.module) {
      filtered = filtered.filter(s => s.module === this.viewFilters.module || 
                                    s.moduleCode.includes(this.viewFilters.module));
    }

    return filtered;
  }
  /*
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
  }*/

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
    
    // Ensure we have a valid session
    if (!session || !session.id) {
      console.error('Invalid session for drag start');
      return;
    }
    
    this.draggedSession = { ...session }; // Create a copy to avoid mutations
    this.isDragging = true;
    this.showDeleteZone = true;
    
    // Set drag data with additional validation
    event.dataTransfer.setData('sessionId', session.id.toString());
    event.dataTransfer.setData('sessionData', JSON.stringify(session));
    event.dataTransfer.effectAllowed = 'move';
    
    // Create enhanced drag preview
    this.createDragPreview(event, session);
    
    // Add visual feedback to the original session
    const sessionElement = event.target as HTMLElement;
    sessionElement.classList.add('dragging-source');
    
    console.log('Enhanced drag started for session:', session.title, 'ID:', session.id);
  }

  onDragEnd(event: DragEvent) {
    // Clean up drag state
    this.draggedSession = null;
    this.isDragging = false;
    this.showDeleteZone = false;
    this.dragOverDeleteZone = false;
    this.highlightedCell = null;
    this.previewDropZone = null;
    
    // Remove visual feedback from source
    const sessionElement = event.target as HTMLElement;
    sessionElement?.classList.remove('dragging-source');
    
    // Clean up ghost element if it exists
    if (this.dragGhost) {
      document.body.removeChild(this.dragGhost);
      this.dragGhost = null;
    }
    
    console.log('Enhanced drag ended');
  }

  onDrop(event: DragEvent, day: number, slot: number) {
    event.preventDefault();
    event.stopPropagation();
    
    const sessionId = event.dataTransfer?.getData('sessionId');
    if (!sessionId || !this.draggedSession) {
      console.log('No session data found for drop');
      this.clearDropState();
      return;
    }
    
    const session = this.sessions.find(s => s.id === +sessionId);
    if (!session || session.id !== this.draggedSession.id) {
      console.log('Session mismatch or not found');
      this.clearDropState();
      return;
    }

    // Apply magnetic snap if enabled
    const finalPosition = this.enableMagneticSnap ? 
                         this.getMagneticSnapPosition(day, slot) : { day, slot };
    
    // Check if dropping in the same position
    if (session.day === finalPosition.day && session.startSlot === finalPosition.slot) {
      console.log('Session dropped in same position');
      this.clearDropState();
      return;
    }

    // Final validation
    const sessionDuration = session.endSlot - session.startSlot;
    const endSlot = finalPosition.slot + sessionDuration;
    
    if (!this.isValidDropPosition(finalPosition.day, finalPosition.slot, endSlot)) {
      console.log('Invalid drop position');
      this.showDropError('Invalid position');
      this.clearDropState();
      return;
    }

    // Check for conflicts with other sessions (excluding the one being moved)
    if (this.enableConflictPrevention && 
        this.hasConflict(session, finalPosition.day, finalPosition.slot)) {
      console.log('Cannot drop session due to conflict');
      this.showDropError('Conflict with existing session');
      this.clearDropState();
      return;
    }

    console.log(`Moving session ${session.title} from day ${session.day}, slot ${session.startSlot} to day ${finalPosition.day}, slot ${finalPosition.slot}`);
    
    // Emit the drop event with enhanced data
    this.sessionDrop.emit({
      session: { ...session },
      day: finalPosition.day,
      startSlot: finalPosition.slot,
      previousDay: session.day,
      previousSlot: session.startSlot,
      isSnapped: this.enableMagneticSnap && 
                (finalPosition.day !== day || finalPosition.slot !== slot)
    });
    
    // Clear all drag state
    this.clearDropState();
  }

  private clearDropState() {
    this.highlightedCell = null;
    this.previewDropZone = null;
  }

  private showDropError(message: string) {
    // Create a temporary error indicator
    const errorElement = document.createElement('div');
    errorElement.className = 'drop-error-indicator';
    errorElement.textContent = message;
    errorElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--ion-color-danger);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(errorElement);
    
    // Remove after 2 seconds
    setTimeout(() => {
      if (document.body.contains(errorElement)) {
        document.body.removeChild(errorElement);
      }
    }, 2000);
  }

  onDragOver(event: DragEvent, day: number, slot: number) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    
    if (!this.draggedSession) return;
    
    // Calculate the session duration for multi-slot sessions
    const sessionDuration = this.draggedSession.endSlot - this.draggedSession.startSlot;
    const endSlot = slot + sessionDuration;
    
    // Check if this is a valid drop position
    const isValidPosition = this.isValidDropPosition(day, slot, endSlot);
    const hasConflict = this.enableConflictPrevention && 
                       this.hasConflict(this.draggedSession, day, slot);
    
    // Magnetic snap to nearby sessions if enabled
    const snapPosition = this.enableMagneticSnap ? 
                        this.getMagneticSnapPosition(day, slot) : { day, slot };
    
    // Update highlight and preview
    this.highlightedCell = { day: snapPosition.day, slot: snapPosition.slot };
    
    if (this.showDropPreview) {
      this.previewDropZone = {
        day: snapPosition.day,
        slot: snapPosition.slot,
        valid: isValidPosition && !hasConflict
      };
    }
    
    // Update cursor based on validity
    event.dataTransfer!.dropEffect = isValidPosition && !hasConflict ? 'move' : 'none';
  }

  private isValidDropPosition(day: number, startSlot: number, endSlot: number): boolean {
    return day >= 0 && day < this.days.length && 
           startSlot >= 0 && endSlot <= this.timeSlots.length &&
           startSlot < endSlot;
  }

  private getMagneticSnapPosition(day: number, slot: number): { day: number, slot: number } {
    // Find nearby sessions and snap to them if close enough
    const snapThreshold = 1; // Snap within 1 slot
    
    for (const session of this.sessions) {
      if (session.id === this.draggedSession?.id) continue;
      
      // Check for horizontal snap (same day, adjacent slots)
      if (session.day === day) {
        if (Math.abs(session.endSlot - slot) <= snapThreshold) {
          return { day, slot: session.endSlot };
        }
        if (Math.abs(session.startSlot - slot) <= snapThreshold) {
          return { day, slot: session.startSlot };
        }
      }
    }
    
    return { day, slot };
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
    if (!sessionId || !this.draggedSession) {
      console.log('No session data found for delete');
      return;
    }
    
    const session = this.sessions.find(s => s.id === +sessionId);
    if (!session || session.id !== this.draggedSession.id) {
      console.log('Session mismatch for delete operation');
      return;
    }

    console.log('Deleting session:', session.title);
    this.sessionDelete.emit({ ...session });
    
    // Clean up drag state
    this.dragOverDeleteZone = false;
    this.highlightedCell = null;
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
    
    // Check if target position is within valid time slots
    if (targetSlot < 0 || targetEndSlot > this.timeSlots.length) {
      console.log('Target position is outside valid time slots');
      return true;
    }
    
    return this.sessions.some(existingSession => {
      // Skip the session being moved
      if (existingSession.id === session.id) return false;
      
      // Check for time slot conflicts on the same day
      if (existingSession.day === targetDay) {
        const hasTimeConflict = 
          (targetSlot >= existingSession.startSlot && targetSlot < existingSession.endSlot) ||
          (targetEndSlot > existingSession.startSlot && targetEndSlot <= existingSession.endSlot) ||
          (targetSlot <= existingSession.startSlot && targetEndSlot >= existingSession.endSlot);
        
        if (hasTimeConflict) {
          console.log(`Conflict detected with session ${existingSession.title} on day ${targetDay}`);
          return true;
        }
      }
      
      return false;
    });
  }

  isCellHighlighted(day: number, slot: number): boolean {
    return this.highlightedCell?.day === day && this.highlightedCell?.slot === slot;
  }

  isCellInConflict(day: number, slot: number): boolean {
    return this.sessions.some(session => 
      session.hasConflict && 
      session.day === day && 
      slot >= session.startSlot && 
      slot < session.endSlot
    );
  }

  // Helper methods for enhanced drag and drop
  isNearMagneticZone(day: number, slot: number): boolean {
    if (!this.enableMagneticSnap || !this.isDragging) return false;
    
    const snapThreshold = 1;
    return this.sessions.some(session => {
      if (session.id === this.draggedSession?.id) return false;
      return session.day === day && 
             (Math.abs(session.startSlot - slot) <= snapThreshold ||
              Math.abs(session.endSlot - slot) <= snapThreshold);
    });
  }

  isMagneticTarget(session: TimetableSession, day: number, slot: number): boolean {
    if (!this.enableMagneticSnap || !this.isDragging || session.id === this.draggedSession?.id) 
      return false;
    
    const snapThreshold = 1;
    return Math.abs(session.startSlot - slot) <= snapThreshold ||
           Math.abs(session.endSlot - slot) <= snapThreshold;
  }

  private generateMockData() {
    // Mock data generation removed - component now only works with provided sessions
    // This prevents duplication and unexpected session behavior
    console.log('Mock data generation disabled for better session management');
  }
}
