import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { TimetableDatabaseService, TimetableDocument } from './timetable-database.service';
import { AuthService } from '../Authentication Services/auth.service';

// Define interfaces for type safety
export interface TimetableSession {
  id: number;
  moduleId: number;
  moduleName: string;
  lecturerId: number;
  lecturer: string;
  venueId: string; // Changed from number to string to match venue.id
  venue: string;
  groupId: number;
  group: string;
  day: string; // 'Monday', 'Tuesday', etc.
  timeSlot: string; // e.g. '09:00 - 10:00'
  startTime?: string; // Optional more precise time
  endTime?: string; // Optional more precise time
  category?: string; // 'Lecture', 'Lab', etc.
  color?: string;
  departmentId: number;
  hasConflict?: boolean;
  notes?: string;
}

export interface Timetable {
  id: number;
  name: string;
  departmentId: number;
  academicYear: string;
  semester: number;
  status: 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected';
  sessions: TimetableSession[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TimetableService {
  private apiUrl = 'api/timetables'; // Replace with your actual API endpoint
  private currentTimetableSubject = new BehaviorSubject<Timetable | null>(null);
  private sessionsSubject = new BehaviorSubject<TimetableSession[]>([]);
  private currentTimetableDocumentSubject = new BehaviorSubject<TimetableDocument | null>(null);

  currentTimetable$ = this.currentTimetableSubject.asObservable();
  sessions$ = this.sessionsSubject.asObservable();
  currentTimetableDocument$ = this.currentTimetableDocumentSubject.asObservable();

  constructor(
    private timetableDatabaseService: TimetableDatabaseService,
    private authService: AuthService
  ) { 
    console.log('TimetableService initialized with database support');
  }

  // Get current active timetable
  getCurrentTimetable(departmentId: number): Observable<Timetable | null> {
    console.log('TimetableService: Getting current timetable for department ID:', departmentId);
    
    // Get current user to determine department
    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser || !currentUser.department) {
      console.warn('No current user or department found');
      return this.createLocalTimetable(departmentId);
    }

    // Try to load from database first
    return this.timetableDatabaseService.getCurrentTimetable(currentUser.department).pipe(
      tap(timetableDoc => {
        if (timetableDoc) {
          console.log('Timetable loaded from database:', timetableDoc);
          this.currentTimetableDocumentSubject.next(timetableDoc);
          
          // Convert to local format
          const timetable: Timetable = {
            id: parseInt(timetableDoc.id) || Date.now(),
            name: timetableDoc.name,
            departmentId: departmentId,
            academicYear: timetableDoc.academicYear,
            semester: timetableDoc.semester,
            status: timetableDoc.status,
            sessions: timetableDoc.sessions || [],
            createdAt: timetableDoc.createdAt?.toDate ? timetableDoc.createdAt.toDate() : new Date(timetableDoc.createdAt),
            updatedAt: timetableDoc.updatedAt?.toDate ? timetableDoc.updatedAt.toDate() : new Date(timetableDoc.updatedAt),
            submittedAt: timetableDoc.submittedAt?.toDate ? timetableDoc.submittedAt.toDate() : undefined
          };
          
          this.currentTimetableSubject.next(timetable);
          this.sessionsSubject.next(timetable.sessions);
        } else {
          console.log('No timetable found in database, creating new one');
          // Create new timetable in database if user has department
          if (currentUser.department) {
            this.createNewTimetableInDatabase(currentUser.department, departmentId);
          }
        }
      }),
      map(timetableDoc => {
        if (!timetableDoc) return null;
        
        return {
          id: parseInt(timetableDoc.id) || Date.now(),
          name: timetableDoc.name,
          departmentId: departmentId,
          academicYear: timetableDoc.academicYear,
          semester: timetableDoc.semester,
          status: timetableDoc.status,
          sessions: timetableDoc.sessions || [],
          createdAt: timetableDoc.createdAt?.toDate ? timetableDoc.createdAt.toDate() : new Date(timetableDoc.createdAt),
          updatedAt: timetableDoc.updatedAt?.toDate ? timetableDoc.updatedAt.toDate() : new Date(timetableDoc.updatedAt),
          submittedAt: timetableDoc.submittedAt?.toDate ? timetableDoc.submittedAt.toDate() : undefined
        } as Timetable;
      }),
      catchError(error => {
        console.error('Error loading timetable from database:', error);
        return this.createLocalTimetable(departmentId);
      })
    );
  }

  // Create local timetable as fallback
  private createLocalTimetable(departmentId: number): Observable<Timetable | null> {
    console.log('Creating local timetable for department:', departmentId);
    
    const storedTimetable = localStorage.getItem(`timetable_${departmentId}`);
    
    if (storedTimetable) {
      const timetable = JSON.parse(storedTimetable) as Timetable;
      this.currentTimetableSubject.next(timetable);
      this.sessionsSubject.next(timetable.sessions);
      return of(timetable);
    }
    
    // If no stored timetable, create a new draft
    return this.createNewTimetable(departmentId, `${new Date().getFullYear()} Timetable`, `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, 1);
  }

  // Create new timetable in database
  private createNewTimetableInDatabase(department: string, departmentId: number): void {
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;
    
    this.timetableDatabaseService.createNewTimetable(
      department,
      `${currentYear} Timetable`,
      academicYear,
      1
    ).subscribe({
      next: (result) => {
        if (result.success && result.timetableId) {
          console.log('New timetable created in database:', result.timetableId);
          // Reload the timetable
          this.getCurrentTimetable(departmentId).subscribe();
        } else {
          console.error('Failed to create new timetable:', result.message);
        }
      },
      error: (error) => {
        console.error('Error creating new timetable in database:', error);
      }
    });
  }

  // Create a new timetable
  createNewTimetable(
    departmentId: number, 
    name: string, 
    academicYear: string, 
    semester: number
  ): Observable<Timetable> {
    const newTimetable: Timetable = {
      id: Date.now(), // Generate a temporary ID
      name,
      departmentId,
      academicYear,
      semester,
      status: 'draft',
      sessions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real app, send to API and return the result
    // For now, store locally and return
    localStorage.setItem(`timetable_${departmentId}`, JSON.stringify(newTimetable));
    
    this.currentTimetableSubject.next(newTimetable);
    this.sessionsSubject.next([]);
    
    return of(newTimetable);
  }

  // Add a session to the current timetable
  addSession(session: Omit<TimetableSession, 'id'>): Observable<TimetableSession> {
    const currentTimetable = this.currentTimetableSubject.value;
    const currentTimetableDoc = this.currentTimetableDocumentSubject.value;
    
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Create a new session with an ID
    const newSession: TimetableSession = {
      ...session,
      id: this.generateSessionId(currentTimetable.sessions)
    };

    // Add to the current sessions
    const updatedSessions = [...currentTimetable.sessions, newSession];
    
    // Update the local timetable
    const updatedTimetable: Timetable = {
      ...currentTimetable,
      sessions: updatedSessions,
      updatedAt: new Date()
    };

    // Store locally first
    localStorage.setItem(`timetable_${currentTimetable.departmentId}`, JSON.stringify(updatedTimetable));
    
    // Update the subjects
    this.currentTimetableSubject.next(updatedTimetable);
    this.sessionsSubject.next(updatedSessions);

    // Also save to database if we have a database timetable
    if (currentTimetableDoc) {
      this.timetableDatabaseService.addOrUpdateSession(currentTimetableDoc.id, newSession).subscribe({
        next: (result) => {
          if (result.success) {
            console.log('Session saved to database successfully');
          } else {
            console.error('Failed to save session to database:', result.message);
          }
        },
        error: (error) => {
          console.error('Error saving session to database:', error);
        }
      });
    }
    
    return of(newSession);
  }

  // Update an existing session
  updateSession(session: TimetableSession): Observable<TimetableSession> {
    const currentTimetable = this.currentTimetableSubject.value;
    const currentTimetableDoc = this.currentTimetableDocumentSubject.value;
    
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Find and update the session
    const updatedSessions = currentTimetable.sessions.map(s => 
      s.id === session.id ? session : s
    );
    
    // Update the local timetable
    const updatedTimetable: Timetable = {
      ...currentTimetable,
      sessions: updatedSessions,
      updatedAt: new Date()
    };

    // Store locally first
    localStorage.setItem(`timetable_${currentTimetable.departmentId}`, JSON.stringify(updatedTimetable));
    
    // Update the subjects
    this.currentTimetableSubject.next(updatedTimetable);
    this.sessionsSubject.next(updatedSessions);

    // Also save to database if we have a database timetable
    if (currentTimetableDoc) {
      this.timetableDatabaseService.addOrUpdateSession(currentTimetableDoc.id, session).subscribe({
        next: (result) => {
          if (result.success) {
            console.log('Session updated in database successfully');
          } else {
            console.error('Failed to update session in database:', result.message);
          }
        },
        error: (error) => {
          console.error('Error updating session in database:', error);
        }
      });
    }
    
    return of(session);
  }

  // Delete a session
  deleteSession(sessionId: number): Observable<boolean> {
    const currentTimetable = this.currentTimetableSubject.value;
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Remove the session
    const updatedSessions = currentTimetable.sessions.filter(s => s.id !== sessionId);
    
    // Update the timetable
    const updatedTimetable: Timetable = {
      ...currentTimetable,
      sessions: updatedSessions,
      updatedAt: new Date()
    };

    // Store the updated timetable
    localStorage.setItem(`timetable_${currentTimetable.departmentId}`, JSON.stringify(updatedTimetable));
    
    // Update the subjects
    this.currentTimetableSubject.next(updatedTimetable);
    this.sessionsSubject.next(updatedSessions);
    
    return of(true);
  }

  // Submit the timetable for approval
  submitTimetable(): Observable<Timetable> {
    const currentTimetable = this.currentTimetableSubject.value;
    const currentTimetableDoc = this.currentTimetableDocumentSubject.value;
    
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Update the local status and submission time
    const submittedTimetable: Timetable = {
      ...currentTimetable,
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    // Store locally first
    localStorage.setItem(`timetable_${currentTimetable.departmentId}`, JSON.stringify(submittedTimetable));
    
    // Update the local subject
    this.currentTimetableSubject.next(submittedTimetable);

    // Submit to database if we have a database timetable
    if (currentTimetableDoc) {
      this.timetableDatabaseService.submitTimetable(currentTimetableDoc.id).subscribe({
        next: (result) => {
          if (result.success) {
            console.log('Timetable submitted to database successfully');
          } else {
            console.error('Failed to submit timetable to database:', result.message);
          }
        },
        error: (error) => {
          console.error('Error submitting timetable to database:', error);
        }
      });
    }
    
    return of(submittedTimetable);
  }

  // Save current timetable to database
  saveTimetableToDatabase(): Observable<{ success: boolean; message: string }> {
    const currentTimetable = this.currentTimetableSubject.value;
    const currentTimetableDoc = this.currentTimetableDocumentSubject.value;
    
    if (!currentTimetable) {
      return of({
        success: false,
        message: 'No active timetable to save'
      });
    }

    // Prepare data for database
    const timetableData = {
      name: currentTimetable.name,
      academicYear: currentTimetable.academicYear,
      semester: currentTimetable.semester,
      status: currentTimetable.status,
      sessions: currentTimetable.sessions
    };

    if (currentTimetableDoc) {
      // Update existing timetable
      return this.timetableDatabaseService.saveTimetable(timetableData, currentTimetableDoc.id).pipe(
        tap(result => {
          if (result.success) {
            console.log('Timetable saved to database successfully');
          } else {
            console.error('Failed to save timetable to database:', result.message);
          }
        })
      );
    } else {
      // Create new timetable if we don't have one
      const currentUser = this.authService.getCurrentUserSync();
      if (!currentUser || !currentUser.department) {
        return of({
          success: false,
          message: 'No user department found'
        });
      }

      return this.timetableDatabaseService.createNewTimetable(
        currentUser.department,
        currentTimetable.name,
        currentTimetable.academicYear,
        currentTimetable.semester
      ).pipe(
        tap(result => {
          if (result.success) {
            console.log('New timetable created in database');
            // Reload the current timetable to sync with database
            this.getCurrentTimetable(currentTimetable.departmentId).subscribe();
          }
        }),
        map(result => ({ success: result.success, message: result.message }))
      );
    }
  }

  // Auto-save functionality
  autoSaveTimetable(): Observable<{ success: boolean; message: string }> {
    console.log('Auto-saving timetable...');
    return this.saveTimetableToDatabase();
  }

  // Detect conflicts in the timetable
  detectConflicts(sessions: TimetableSession[]): { hasConflicts: boolean, conflictingSessions: TimetableSession[] } {
    const conflictingSessions: TimetableSession[] = [];
    
    // Check for venue conflicts
    const venueConflicts = this.detectVenueConflicts(sessions);
    
    // Check for lecturer conflicts
    const lecturerConflicts = this.detectLecturerConflicts(sessions);
    
    // Check for group conflicts
    const groupConflicts = this.detectGroupConflicts(sessions);
    
    // Combine all conflicts (avoiding duplicates)
    const allConflictIds = new Set([
      ...venueConflicts.map(s => s.id),
      ...lecturerConflicts.map(s => s.id),
      ...groupConflicts.map(s => s.id)
    ]);
    
    sessions.forEach(session => {
      if (allConflictIds.has(session.id)) {
        session.hasConflict = true;
        conflictingSessions.push(session);
      } else {
        session.hasConflict = false;
      }
    });
    
    return {
      hasConflicts: conflictingSessions.length > 0,
      conflictingSessions
    };
  }

  // Helper methods for conflict detection
  private detectVenueConflicts(sessions: TimetableSession[]): TimetableSession[] {
    const venueMap: { [key: string]: TimetableSession[] } = {};
    const conflicts: TimetableSession[] = [];
    
    sessions.forEach(session => {
      const key = `${session.venueId}-${session.day}-${session.timeSlot}`;
      if (!venueMap[key]) {
        venueMap[key] = [];
      }
      venueMap[key].push(session);
    });
    
    Object.values(venueMap).forEach(venueSessions => {
      if (venueSessions.length > 1) {
        conflicts.push(...venueSessions);
      }
    });
    
    return conflicts;
  }

  private detectLecturerConflicts(sessions: TimetableSession[]): TimetableSession[] {
    const lecturerMap: { [key: string]: TimetableSession[] } = {};
    const conflicts: TimetableSession[] = [];
    
    sessions.forEach(session => {
      const key = `${session.lecturerId}-${session.day}-${session.timeSlot}`;
      if (!lecturerMap[key]) {
        lecturerMap[key] = [];
      }
      lecturerMap[key].push(session);
    });
    
    Object.values(lecturerMap).forEach(lecturerSessions => {
      if (lecturerSessions.length > 1) {
        conflicts.push(...lecturerSessions);
      }
    });
    
    return conflicts;
  }

  private detectGroupConflicts(sessions: TimetableSession[]): TimetableSession[] {
    const groupMap: { [key: string]: TimetableSession[] } = {};
    const conflicts: TimetableSession[] = [];
    
    sessions.forEach(session => {
      const key = `${session.groupId}-${session.day}-${session.timeSlot}`;
      if (!groupMap[key]) {
        groupMap[key] = [];
      }
      groupMap[key].push(session);
    });
    
    Object.values(groupMap).forEach(groupSessions => {
      if (groupSessions.length > 1) {
        conflicts.push(...groupSessions);
      }
    });
    
    return conflicts;
  }

  // Helper method to generate session ID
  private generateSessionId(sessions: TimetableSession[]): number {
    if (sessions.length === 0) return 1;
    return Math.max(...sessions.map(s => s.id)) + 1;
  }
}
