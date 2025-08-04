import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Define Module and ModulesDocument interfaces for Firestore data
interface Module {
  name: string;
  code?: string;
  [key: string]: any;
}

interface ModulesDocument {
  modules: Module[];
  [key: string]: any;
}
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { AcademicCalendarUploadComponent, AcademicCalendarData } from '../academic-calendar-upload/academic-calendar-upload.component';

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
  weekNumber?: number; // Optional week number for week-specific sessions
}

export interface SessionDropEvent {
  session: TimetableSession;
  day: number;
  startSlot: number;
  previousDay?: number;
  previousSlot?: number;
  isSnapped?: boolean;
}

export interface AcademicWeekConfig {
  academicStartWeek: number;
  academicEndWeek: number;
  currentWeek: number;
  totalWeeks: number;
  semesterBreakWeeks: number[];
  examWeeks: number[];
  customWeekLabels: Map<number, string>;
}

export interface WeekChangeEvent {
  weekNumber: number;
  isAcademicWeek: boolean;
  weekLabel: string;
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
  @Input() showWeekControls: boolean = true; // New input to show/hide week controls
  @Input() initialWeekConfig?: Partial<AcademicWeekConfig>; // Allow parent to override config
  
  @Output() sessionClick = new EventEmitter<TimetableSession>();
  @Output() sessionDrop = new EventEmitter<SessionDropEvent>();
  @Output() sessionDelete = new EventEmitter<TimetableSession>();
  @Output() weekChange = new EventEmitter<WeekChangeEvent>(); // New output for week changes

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
    { id: 1, start: '08:30', end: '09:10' },
    { id: 2, start: '09:15', end: '09:55' },
    { id: 3, start: '10:15', end: '10:55' },
    { id: 4, start: '11:00', end: '11:40' },
    { id: 5, start: '11:45', end: '12:25' },
    { id: 6, start: '13:05', end: '13:45' },
    { id: 7, start: '13:50', end: '14:30' },
    { id: 8, start: '14:35', end: '15:10' },
    { id: 9, start: '15:15', end: '16:00' }
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

  // Academic Week Configuration - MUT Academic Calendar 2025
  academicWeekConfig: AcademicWeekConfig = {
    academicStartWeek: 2, // University opens Monday, 06 January 2025 (Week 2)
    academicEndWeek: 50, // University closes Friday, 12 December 2025 (Week 50)
    currentWeek: 0, // Will be set in ngOnInit
    totalWeeks: 52,
    semesterBreakWeeks: [14, 26, 27, 28], // March recess (Week 14), Mid-year break (Weeks 26-28)
    examWeeks: [21, 22, 23, 24, 25, 41, 42, 43, 45, 46, 47, 48, 49], // First semester exams (21-25), Annual exams (41-43), Second semester exams (45-49)
    customWeekLabels: new Map<number, string>()
  };

  // Week selection and display
  selectedWeek: number = 0; // Will be set in ngOnInit
  weekViewMode: 'current' | 'selected' | 'range' = 'current';
  calendarViewMode: 'timeline' | 'grid' | 'radial' | 'gantt' | 'heatmap' = 'timeline';
  
  // MUT Academic Calendar 2025 data
  mutAcademicCalendar2025: AcademicCalendarData | null = null;
  academicWeeks: any[] = [];
  
  // Filtered sessions based on selected week
  filteredSessions: TimetableSession[] = [];

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
  ,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) { }

  async ngOnInit() {
    // Initialize academic week configuration
    this.initializeAcademicWeeks();
    
    // No mock data generation - use only provided sessions
    await this.fetchFilterOptions();
    this.updateSessionTracker();
    this.filterSessionsByWeek();
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
      this.filterSessionsByWeek();
      // Force change detection to update the view
      this.cdr.detectChanges();
    }

    // Handle initial week config changes
    if (changes['initialWeekConfig'] && changes['initialWeekConfig'].currentValue) {
      this.updateAcademicWeekConfig(changes['initialWeekConfig'].currentValue);
    }
    
    console.log('Sessions updated:', this.sessions.length, 'unique sessions');
  }

  private async fetchFilterOptions() {
    try {
      // Fetch venues
      const venueSnapshot = await getDocs(collection(this.firestore, 'venues'));
      this.venues = venueSnapshot.docs.map(doc => doc.data()['name']).sort();

      // Fetch modules (handle array of module objects)
      const moduleSnapshot = await getDocs(collection(this.firestore, 'module'));
      this.modules = moduleSnapshot.docs
        .flatMap((doc): Module[] => {
          const data = doc.data() as ModulesDocument;
          return data.modules || [];
        })
        .map((module: Module) => module.name)
        .filter((item): item is string => !!item)
        .sort() || ['All Modules']

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
    // Start with week-filtered sessions instead of all sessions
    let filtered = [...this.filteredSessions];

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

  // Academic Week Methods
  private initializeAcademicWeeks(): void {
    this.loadAcademicWeekConfig();
    this.academicWeekConfig.currentWeek = this.getCurrentWeekNumber();
    this.selectedWeek = this.academicWeekConfig.currentWeek;
    
    // Apply any parent-provided config
    if (this.initialWeekConfig) {
      this.updateAcademicWeekConfig(this.initialWeekConfig);
    }
    
    this.setDefaultWeekLabels();
  }

  getCurrentWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }

  getWeekStartDate(weekNumber: number, year: number = new Date().getFullYear()): Date {
    const firstDay = new Date(year, 0, 1);
    const daysToAdd = (weekNumber - 1) * 7;
    const weekStart = new Date(firstDay.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday (start of week)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    return weekStart;
  }

  getWeekEndDate(weekNumber: number, year: number = new Date().getFullYear()): Date {
    const weekStart = this.getWeekStartDate(weekNumber, year);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  getWeekLabel(weekNumber: number): string {
    // Check for custom labels first (MUT-specific dates)
    if (this.academicWeekConfig.customWeekLabels.has(weekNumber)) {
      return this.academicWeekConfig.customWeekLabels.get(weekNumber)!;
    }

    // Check for exam weeks
    if (this.academicWeekConfig.examWeeks.includes(weekNumber)) {
      if (weekNumber >= 21 && weekNumber <= 25) {
        return `Week ${weekNumber} (1st Semester Exams)`;
      } else if (weekNumber >= 41 && weekNumber <= 43) {
        return `Week ${weekNumber} (Annual Programme Exams)`;
      } else if (weekNumber >= 45 && weekNumber <= 49) {
        return `Week ${weekNumber} (2nd Semester Exams)`;
      }
      return `Week ${weekNumber} (Exams)`;
    }

    // Check for semester breaks
    if (this.academicWeekConfig.semesterBreakWeeks.includes(weekNumber)) {
      if (weekNumber === 14) {
        return `Week ${weekNumber} (April Recess)`;
      } else if (weekNumber >= 26 && weekNumber <= 28) {
        return `Week ${weekNumber} (Mid-Year Break)`;
      }
      return `Week ${weekNumber} (Break)`;
    }

    // Calculate academic week number (relative to academic start)
    const academicWeek = weekNumber - this.academicWeekConfig.academicStartWeek + 1;
    
    // Before academic year starts
    if (weekNumber < this.academicWeekConfig.academicStartWeek) {
      return `Week ${weekNumber} (Pre-Academic)`;
    }
    
    // After academic year ends
    if (weekNumber > this.academicWeekConfig.academicEndWeek) {
      return `Week ${weekNumber} (Summer Recess)`;
    }

    // Determine semester
    if (weekNumber >= 2 && weekNumber <= 25) {
      return `Week ${weekNumber} (Semester 1 - Academic Week ${academicWeek})`;
    } else if (weekNumber >= 29 && weekNumber <= 50) {
      const semester2Start = 29;
      const semester2Week = weekNumber - semester2Start + 1;
      return `Week ${weekNumber} (Semester 2 - Academic Week ${semester2Week})`;
    }

    return `Week ${weekNumber} (Academic Week ${academicWeek})`;
  }

  getAcademicProgress(): number {
    const { academicStartWeek, academicEndWeek, currentWeek } = this.academicWeekConfig;
    
    if (currentWeek < academicStartWeek) return 0;
    if (currentWeek > academicEndWeek) return 100;
    
    const totalAcademicWeeks = academicEndWeek - academicStartWeek + 1;
    const completedWeeks = currentWeek - academicStartWeek + 1;
    
    return Math.round((completedWeeks / totalAcademicWeeks) * 100);
  }

  isCurrentWeek(weekNumber: number): boolean {
    return weekNumber === this.academicWeekConfig.currentWeek;
  }

  isAcademicWeek(weekNumber: number): boolean {
    return weekNumber >= this.academicWeekConfig.academicStartWeek && 
           weekNumber <= this.academicWeekConfig.academicEndWeek;
  }

  navigateToWeek(weekNumber: number): void {
    if (weekNumber >= 1 && weekNumber <= this.academicWeekConfig.totalWeeks) {
      this.selectedWeek = weekNumber;
      this.filterSessionsByWeek();
      
      // Emit week change event
      this.weekChange.emit({
        weekNumber,
        isAcademicWeek: this.isAcademicWeek(weekNumber),
        weekLabel: this.getWeekLabel(weekNumber)
      });
    }
  }

  navigateToPreviousWeek(): void {
    if (this.selectedWeek > 1) {
      this.navigateToWeek(this.selectedWeek - 1);
    }
  }

  navigateToNextWeek(): void {
    if (this.selectedWeek < this.academicWeekConfig.totalWeeks) {
      this.navigateToWeek(this.selectedWeek + 1);
    }
  }

  navigateToCurrentWeek(): void {
    this.navigateToWeek(this.academicWeekConfig.currentWeek);
  }

  private filterSessionsByWeek(): void {
    // Filter sessions based on selected week
    // For now, show all sessions if no week filtering is implemented
    // You can extend this to filter by session.weekNumber
    this.filteredSessions = this.sessions.filter(session => {
      // If session has a weekNumber, filter by it
      if (session.weekNumber !== undefined) {
        return session.weekNumber === this.selectedWeek;
      }
      // Otherwise, show all sessions (recurring sessions)
      return true;
    });
  }

  async showAcademicWeekConfigModal(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Configure Academic Year',
      subHeader: 'Set your academic year week range',
      inputs: [
        {
          name: 'startWeek',
          type: 'number',
          placeholder: 'Start Week (1-52)',
          value: this.academicWeekConfig.academicStartWeek,
          min: 1,
          max: 52
        },
        {
          name: 'endWeek',
          type: 'number',
          placeholder: 'End Week (1-52)',
          value: this.academicWeekConfig.academicEndWeek,
          min: 1,
          max: 52
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: (data) => {
            const startWeek = parseInt(data.startWeek);
            const endWeek = parseInt(data.endWeek);
            
            if (startWeek >= 1 && startWeek <= 52 && endWeek >= 1 && endWeek <= 52 && startWeek < endWeek) {
              this.updateAcademicWeekConfig({ academicStartWeek: startWeek, academicEndWeek: endWeek });
              return true;
            }
            return false;
          }
        }
      ]
    });

    await alert.present();
  }

  private updateAcademicWeekConfig(config: Partial<AcademicWeekConfig>): void {
    this.academicWeekConfig = { ...this.academicWeekConfig, ...config };
    this.saveAcademicWeekConfig();
    this.filterSessionsByWeek();
  }

  private saveAcademicWeekConfig(): void {
    const customWeekLabelsObject: { [key: string]: string } = {};
    this.academicWeekConfig.customWeekLabels.forEach((value, key) => {
      customWeekLabelsObject[key.toString()] = value;
    });
    
    const configToSave = {
      ...this.academicWeekConfig,
      customWeekLabels: customWeekLabelsObject
    };
    
    localStorage.setItem('timetableGridAcademicWeekConfig', JSON.stringify(configToSave));
  }

  private loadAcademicWeekConfig(): void {
    const saved = localStorage.getItem('timetableGridAcademicWeekConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.academicWeekConfig = {
          ...this.academicWeekConfig,
          ...config,
          currentWeek: this.getCurrentWeekNumber()
        };
        
        if (config.customWeekLabels) {
          this.academicWeekConfig.customWeekLabels = new Map();
          Object.keys(config.customWeekLabels).forEach(key => {
            this.academicWeekConfig.customWeekLabels.set(parseInt(key), config.customWeekLabels[key]);
          });
        }
      } catch (error) {
        console.error('Error loading academic week config:', error);
      }
    }
  }

  private setDefaultWeekLabels(): void {
    if (this.academicWeekConfig.customWeekLabels.size === 0) {
      // MUT Academic Calendar 2025 specific labels
      this.academicWeekConfig.customWeekLabels.set(1, 'New Year Holiday');
      this.academicWeekConfig.customWeekLabels.set(2, 'University Opens (06 Jan)');
      this.academicWeekConfig.customWeekLabels.set(3, 'Academic Staff Returns (13 Jan)');
      this.academicWeekConfig.customWeekLabels.set(5, 'Registration Week');
      this.academicWeekConfig.customWeekLabels.set(7, 'Lectures Commence (10 Feb)');
      this.academicWeekConfig.customWeekLabels.set(13, 'End of 1st Term (28 Mar)');
      this.academicWeekConfig.customWeekLabels.set(14, 'April Recess');
      this.academicWeekConfig.customWeekLabels.set(15, '2nd Term Begins (07 Apr)');
      this.academicWeekConfig.customWeekLabels.set(17, 'Graduation Week');
      this.academicWeekConfig.customWeekLabels.set(20, 'Study Break (14-19 May)');
      this.academicWeekConfig.customWeekLabels.set(21, '1st Semester Exams Begin');
      this.academicWeekConfig.customWeekLabels.set(24, '1st Semester Exams End');
      this.academicWeekConfig.customWeekLabels.set(25, 'Supplementary Exams');
      this.academicWeekConfig.customWeekLabels.set(26, 'Mid-Year Break');
      this.academicWeekConfig.customWeekLabels.set(27, 'Mid-Year Break');
      this.academicWeekConfig.customWeekLabels.set(28, 'Mid-Year Break');
      this.academicWeekConfig.customWeekLabels.set(29, '2nd Semester Registration');
      this.academicWeekConfig.customWeekLabels.set(30, '2nd Semester Begins');
      this.academicWeekConfig.customWeekLabels.set(39, 'End of 3rd Term (19 Sep)');
      this.academicWeekConfig.customWeekLabels.set(40, '4th Term Begins (29 Sep)');
      this.academicWeekConfig.customWeekLabels.set(41, 'Annual Exams Begin');
      this.academicWeekConfig.customWeekLabels.set(43, 'Annual Exams End');
      this.academicWeekConfig.customWeekLabels.set(44, 'Study Break (28 Oct - 02 Nov)');
      this.academicWeekConfig.customWeekLabels.set(45, '2nd Semester Exams Begin');
      this.academicWeekConfig.customWeekLabels.set(47, '2nd Semester Exams End');
      this.academicWeekConfig.customWeekLabels.set(48, '2nd Semester Supplementary');
      this.academicWeekConfig.customWeekLabels.set(50, 'University Closes (12 Dec)');
      this.academicWeekConfig.customWeekLabels.set(51, 'Summer Recess');
      this.academicWeekConfig.customWeekLabels.set(52, 'Summer Recess');
    }
  }

  async addCustomWeekLabel(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Add Custom Week Label',
      inputs: [
        {
          name: 'weekNumber',
          type: 'number',
          placeholder: 'Week Number (1-52)',
          min: 1,
          max: 52
        },
        {
          name: 'label',
          type: 'text',
          placeholder: 'Custom Label (e.g., "Orientation Week")'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add',
          handler: (data) => {
            const weekNumber = parseInt(data.weekNumber);
            const label = data.label?.trim();
            
            if (weekNumber >= 1 && weekNumber <= 52 && label) {
              this.academicWeekConfig.customWeekLabels.set(weekNumber, label);
              this.saveAcademicWeekConfig();
              this.showSuccessToast(`Custom label added for week ${weekNumber}`);
              return true;
            }
            return false;
          }
        }
      ]
    });

    await alert.present();
  }

  private async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  }

  // Enhanced Visual Representation Methods
  getWeekTypeColor(weekNumber: number): string {
    if (this.academicWeekConfig.examWeeks.includes(weekNumber)) {
      return '#eb445a'; // Red for exams
    }
    if (this.academicWeekConfig.semesterBreakWeeks.includes(weekNumber)) {
      return '#ffc409'; // Yellow for breaks
    }
    if (this.isAcademicWeek(weekNumber)) {
      if (weekNumber >= 2 && weekNumber <= 25) {
        return '#4c8dff'; // Blue for Semester 1
      } else if (weekNumber >= 29 && weekNumber <= 50) {
        return '#2dd36f'; // Green for Semester 2
      }
    }
    return '#92949c'; // Gray for non-academic
  }

  getSemesterSegments(): Array<{start: number, end: number, label: string, color: string}> {
    return [
      {
        start: 1,
        end: 1,
        label: 'Pre-Academic',
        color: '#92949c'
      },
      {
        start: 2,
        end: 13,
        label: 'Semester 1 - Term 1',
        color: '#4c8dff'
      },
      {
        start: 14,
        end: 14,
        label: 'April Break',
        color: '#ffc409'
      },
      {
        start: 15,
        end: 20,
        label: 'Semester 1 - Term 2',
        color: '#4c8dff'
      },
      {
        start: 21,
        end: 25,
        label: 'S1 Exams',
        color: '#eb445a'
      },
      {
        start: 26,
        end: 28,
        label: 'Mid-Year Break',
        color: '#ffc409'
      },
      {
        start: 29,
        end: 39,
        label: 'Semester 2 - Term 3',
        color: '#2dd36f'
      },
      {
        start: 40,
        end: 40,
        label: 'Break',
        color: '#ffc409'
      },
      {
        start: 41,
        end: 43,
        label: 'Annual Exams',
        color: '#eb445a'
      },
      {
        start: 44,
        end: 44,
        label: 'Study Break',
        color: '#ffc409'
      },
      {
        start: 45,
        end: 50,
        label: 'S2 Term 4 & Exams',
        color: '#2dd36f'
      },
      {
        start: 51,
        end: 52,
        label: 'Summer Recess',
        color: '#92949c'
      }
    ];
  }

  getWeekPosition(weekNumber: number): number {
    return ((weekNumber - 1) / 52) * 100;
  }

  getCurrentPhase(): {name: string, color: string, description: string} {
    const week = this.academicWeekConfig.currentWeek;
    
    if (week >= 21 && week <= 25) {
      return {
        name: '1st Semester Exams',
        color: '#eb445a',
        description: 'Examination period for first semester modules'
      };
    } else if (week >= 41 && week <= 43) {
      return {
        name: 'Annual Programme Exams',
        color: '#eb445a',
        description: 'Examination period for annual programme modules'
      };
    } else if (week >= 45 && week <= 49) {
      return {
        name: '2nd Semester Exams',
        color: '#eb445a',
        description: 'Examination period for second semester modules'
      };
    } else if (this.academicWeekConfig.semesterBreakWeeks.includes(week)) {
      return {
        name: 'Academic Break',
        color: '#ffc409',
        description: 'Non-teaching period - recess time'
      };
    } else if (week >= 2 && week <= 25) {
      return {
        name: 'Semester 1',
        color: '#4c8dff',
        description: 'First semester teaching period'
      };
    } else if (week >= 29 && week <= 50) {
      return {
        name: 'Semester 2',
        color: '#2dd36f',
        description: 'Second semester teaching period'
      };
    } else {
      return {
        name: 'Non-Academic Period',
        color: '#92949c',
        description: 'Outside the academic calendar'
      };
    }
  }

  getUpcomingMilestones(): Array<{week: number, label: string, daysAway: number}> {
    const currentWeek = this.academicWeekConfig.currentWeek;
    const milestones = [
      { week: 7, label: 'Lectures Commence' },
      { week: 13, label: 'End of 1st Term' },
      { week: 17, label: 'Graduation Week' },
      { week: 21, label: '1st Semester Exams Begin' },
      { week: 26, label: 'Mid-Year Break Starts' },
      { week: 29, label: '2nd Semester Begins' },
      { week: 41, label: 'Annual Exams Begin' },
      { week: 45, label: '2nd Semester Exams Begin' },
      { week: 50, label: 'University Closes' }
    ];

    return milestones
      .filter(m => m.week > currentWeek)
      .slice(0, 3)
      .map(m => ({
        ...m,
        daysAway: (m.week - currentWeek) * 7
      }));
  }

  // Alternative Visual Representation Methods
  getCalendarGrid(): Array<Array<{week: number, label: string, color: string, isCurrentWeek: boolean}>> {
    const grid = [];
    let week = 1;
    
    // Create a 13x4 grid (52 weeks = 13 rows × 4 columns)
    for (let row = 0; row < 13; row++) {
      const currentRow = [];
      for (let col = 0; col < 4; col++) {
        if (week <= 52) {
          currentRow.push({
            week,
            label: this.getShortWeekLabel(week),
            color: this.getWeekTypeColor(week),
            isCurrentWeek: week === this.academicWeekConfig.currentWeek
          });
          week++;
        }
      }
      grid.push(currentRow);
    }
    return grid;
  }

  getEnhancedCalendarGrid(): Array<Array<{
    week: number, 
    dayOfMonth: number,
    color: string, 
    isCurrentWeek: boolean,
    isAcademicWeek: boolean,
    isExamWeek: boolean,
    isBreakWeek: boolean,
    typeIndicator: string,
    fullLabel: string
  }>> {
    const grid = [];
    const year = 2025;
    const startDate = new Date(year, 0, 1); // January 1, 2025
    
    // Create 52 weeks, 7 days each
    for (let week = 1; week <= 52; week++) {
      const weekRow = [];
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + ((week - 1) * 7) + day);
        
        const isCurrentWeek = week === this.academicWeekConfig.currentWeek;
        const isAcademicWeek = this.isAcademicWeek(week);
        const isExamWeek = this.academicWeekConfig.examWeeks.includes(week);
        const isBreakWeek = this.academicWeekConfig.semesterBreakWeeks.includes(week);
        
        let typeIndicator = '';
        if (isExamWeek) typeIndicator = 'E';
        else if (isBreakWeek) typeIndicator = 'B';
        else if (isAcademicWeek) typeIndicator = 'A';
        
        weekRow.push({
          week,
          dayOfMonth: currentDate.getDate(),
          color: this.getWeekTypeColor(week),
          isCurrentWeek,
          isAcademicWeek,
          isExamWeek,
          isBreakWeek,
          typeIndicator,
          fullLabel: this.getWeekLabel(week) + ' - ' + currentDate.toDateString()
        });
      }
      grid.push(weekRow);
    }
    return grid;
  }

  getShortWeekLabel(weekNumber: number): string {
    if (this.academicWeekConfig.examWeeks.includes(weekNumber)) {
      return 'EXAM';
    }
    if (this.academicWeekConfig.semesterBreakWeeks.includes(weekNumber)) {
      return 'BREAK';
    }
    if (weekNumber >= 2 && weekNumber <= 25) {
      return 'S1';
    } else if (weekNumber >= 29 && weekNumber <= 50) {
      return 'S2';
    }
    return 'OFF';
  }

  getRadialCalendar(): Array<{week: number, angle: number, radius: number, color: string, label: string}> {
    const weeks = [];
    for (let week = 1; week <= 52; week++) {
      const angle = (week - 1) * (360 / 52); // Distribute evenly around circle
      const radius = this.isAcademicWeek(week) ? 80 : 60; // Academic weeks farther out
      weeks.push({
        week,
        angle,
        radius,
        color: this.getWeekTypeColor(week),
        label: this.getShortWeekLabel(week)
      });
    }
    return weeks;
  }

  getSpiralCalendar(): Array<{week: number, x: number, y: number, color: string, size: number}> {
    const spiral = [];
    const centerX = 150;
    const centerY = 150;
    
    for (let week = 1; week <= 52; week++) {
      const angle = (week - 1) * 0.3; // Spiral growth rate
      const radius = 20 + (week - 1) * 2; // Expanding spiral
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const size = this.academicWeekConfig.examWeeks.includes(week) ? 12 : 
                   this.isAcademicWeek(week) ? 10 : 8;
      
      spiral.push({
        week,
        x,
        y,
        color: this.getWeekTypeColor(week),
        size
      });
    }
    return spiral;
  }

  getCalendarHeatmap(): Array<Array<{week: number, value: number, color: string, date: Date}>> {
    const heatmap = [];
    const startDate = new Date(2025, 0, 1); // January 1, 2025
    
    // Create a 7x52 grid (7 days × 52 weeks)
    for (let day = 0; day < 7; day++) {
      const currentRow = [];
      for (let week = 1; week <= 52; week++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + ((week - 1) * 7) + day);
        
        // Calculate "intensity" based on week type
        let value = 0;
        if (this.academicWeekConfig.examWeeks.includes(week)) value = 4;
        else if (this.academicWeekConfig.semesterBreakWeeks.includes(week)) value = 2;
        else if (this.isAcademicWeek(week)) value = 3;
        else value = 1;
        
        currentRow.push({
          week,
          value,
          color: this.getWeekTypeColor(week),
          date: currentDate
        });
      }
      heatmap.push(currentRow);
    }
    return heatmap;
  }

  getGanttChart(): Array<{id: string, name: string, start: number, end: number, color: string, type: string}> {
    return [
      {
        id: 'pre-academic',
        name: 'Pre-Academic Period',
        start: 1,
        end: 1,
        color: '#92949c',
        type: 'preparation'
      },
      {
        id: 'semester1-term1',
        name: 'Semester 1 - Term 1',
        start: 2,
        end: 13,
        color: '#4c8dff',
        type: 'teaching'
      },
      {
        id: 'april-break',
        name: 'April Recess',
        start: 14,
        end: 14,
        color: '#ffc409',
        type: 'break'
      },
      {
        id: 'semester1-term2',
        name: 'Semester 1 - Term 2',
        start: 15,
        end: 20,
        color: '#4c8dff',
        type: 'teaching'
      },
      {
        id: 's1-exams',
        name: '1st Semester Exams',
        start: 21,
        end: 25,
        color: '#eb445a',
        type: 'exams'
      },
      {
        id: 'midyear-break',
        name: 'Mid-Year Break',
        start: 26,
        end: 28,
        color: '#ffc409',
        type: 'break'
      },
      {
        id: 'semester2-term3',
        name: 'Semester 2 - Term 3',
        start: 29,
        end: 39,
        color: '#2dd36f',
        type: 'teaching'
      },
      {
        id: 'term-break',
        name: 'Term Break',
        start: 40,
        end: 40,
        color: '#ffc409',
        type: 'break'
      },
      {
        id: 'annual-exams',
        name: 'Annual Programme Exams',
        start: 41,
        end: 43,
        color: '#eb445a',
        type: 'exams'
      },
      {
        id: 'study-break',
        name: 'Study Break',
        start: 44,
        end: 44,
        color: '#ffc409',
        type: 'break'
      },
      {
        id: 'semester2-term4',
        name: 'Semester 2 - Term 4 & Exams',
        start: 45,
        end: 50,
        color: '#2dd36f',
        type: 'teaching'
      },
      {
        id: 'summer-recess',
        name: 'Summer Recess',
        start: 51,
        end: 52,
        color: '#92949c',
        type: 'break'
      }
    ];
  }

  onCalendarViewChange(event: any): void {
    this.calendarViewMode = event.detail.value;
  }

  // Method to open academic calendar upload
  async openCalendarUpload() {
    const modal = await this.modalController.create({
      component: AcademicCalendarUploadComponent,
      cssClass: 'calendar-upload-modal'
    });

    modal.onDidDismiss().then((result) => {
      if (result.data && result.data.calendarData) {
        this.applyUploadedCalendar(result.data.calendarData);
      }
    });

    return await modal.present();
  }

  // Method to apply uploaded calendar data
  private applyUploadedCalendar(calendarData: AcademicCalendarData) {
    try {
      // Store the uploaded calendar data
      this.mutAcademicCalendar2025 = calendarData;
      
      // Update academic week configuration based on new calendar
      this.updateAcademicWeekConfigFromCalendar(calendarData);
      
      // Update academic weeks array
      this.updateAcademicWeeksFromCalendar();
      
      // Refresh the display
      this.filterSessionsByWeek();
      this.cdr.detectChanges();
      
      this.showToast('Academic calendar updated successfully!', 'success');
    } catch (error) {
      console.error('Error applying uploaded calendar:', error);
      this.showToast('Error applying calendar data. Please check the format.', 'danger');
    }
  }

  // Helper method to update academic week config from calendar data
  private updateAcademicWeekConfigFromCalendar(calendarData: AcademicCalendarData) {
    const allWeeks = this.extractWeeksFromCalendar(calendarData);
    
    if (allWeeks.length > 0) {
      const weekNumbers = allWeeks.map(w => w.weekNumber).sort((a, b) => a - b);
      
      // Update the academic week configuration
      this.academicWeekConfig = {
        ...this.academicWeekConfig,
        academicStartWeek: Math.min(...weekNumbers),
        academicEndWeek: Math.max(...weekNumbers),
        currentWeek: this.getCurrentWeekNumber(),
        totalWeeks: 52
      };
      
      // Update custom week labels
      this.updateCustomWeekLabels(allWeeks);
      
      // Save the configuration
      this.saveAcademicWeekConfig();
    }
  }

  // Extract all weeks from calendar data
  private extractWeeksFromCalendar(calendarData: AcademicCalendarData): any[] {
    // The weeks are stored directly in the calendar data, not in terms
    return calendarData.weeks.map(week => ({
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      type: week.type,
      label: week.label,
      events: week.events || []
    }));
  }

  // Update custom week labels from calendar weeks
  private updateCustomWeekLabels(weeks: any[]) {
    const customLabels = new Map<number, string>();
    
    weeks.forEach(week => {
      if (week.label && week.label !== `Week ${week.weekNumber}`) {
        customLabels.set(week.weekNumber, week.label);
      }
      
      // Add event labels
      if (week.events && week.events.length > 0) {
        const eventLabels = week.events.map((e: any) => e.name).join(', ');
        const existingLabel = customLabels.get(week.weekNumber);
        const finalLabel = existingLabel ? `${existingLabel} - ${eventLabels}` : eventLabels;
        customLabels.set(week.weekNumber, finalLabel);
      }
    });
    
    this.academicWeekConfig.customWeekLabels = customLabels;
  }

  // Method to update academic weeks from calendar
  private updateAcademicWeeksFromCalendar() {
    // Regenerate academic weeks array based on the new calendar
    // This will update week numbers, types, and special events
    this.generateAcademicWeeksFromCalendar();
  }

  // Generate academic weeks from calendar data
  private generateAcademicWeeksFromCalendar() {
    this.academicWeeks = [];
    
    if (this.mutAcademicCalendar2025 && this.mutAcademicCalendar2025.weeks) {
      // Use the weeks directly from the calendar data
      this.academicWeeks = this.mutAcademicCalendar2025.weeks.map(week => ({
        weekNumber: week.weekNumber,
        startDate: new Date(week.startDate),
        endDate: new Date(week.endDate),
        type: week.type || 'academic',
        label: week.label || `Week ${week.weekNumber}`,
        events: week.events || []
      }));
    }
  }

  // Helper method to show toast messages
  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color
    });
    toast.present();
  }
}
