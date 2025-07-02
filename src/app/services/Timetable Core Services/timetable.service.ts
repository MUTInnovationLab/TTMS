import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
// Remove HttpClient import temporarily
// import { HttpClient } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';

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
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
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

  currentTimetable$ = this.currentTimetableSubject.asObservable();
  sessions$ = this.sessionsSubject.asObservable();

  // Remove HttpClient from constructor temporarily
  constructor() { }

  // Get current active timetable
  getCurrentTimetable(departmentId: number): Observable<Timetable | null> {
    // In a real application, this would fetch from the API
    // For now, we'll use mock data or local storage
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
    
    return of(newSession);
  }

  // Update an existing session
  updateSession(session: TimetableSession): Observable<TimetableSession> {
    const currentTimetable = this.currentTimetableSubject.value;
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Find and update the session
    const updatedSessions = currentTimetable.sessions.map(s => 
      s.id === session.id ? session : s
    );
    
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
    if (!currentTimetable) {
      throw new Error('No active timetable');
    }

    // Update the status and submission time
    const submittedTimetable: Timetable = {
      ...currentTimetable,
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    // Store the updated timetable
    localStorage.setItem(`timetable_${currentTimetable.departmentId}`, JSON.stringify(submittedTimetable));
    
    // Update the subject
    this.currentTimetableSubject.next(submittedTimetable);
    
    return of(submittedTimetable);
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
