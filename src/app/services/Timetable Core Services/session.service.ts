import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
// Remove HttpClient import temporarily
// import { HttpClient } from '@angular/common/http';
import { TimetableService, TimetableSession } from './timetable.service';

export interface SessionRequest {
  moduleId: number;
  moduleName: string;
  lecturerId: number;
  lecturer: string;
  venueId: string; // Changed from number to string
  venue: string;
  groupId: number;
  group: string;
  day: string;
  timeSlot: string;
  departmentId: number;
  category?: string;
  notes?: string;
}

export interface TimeSlot {
  id: number;
  time: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private apiUrl = 'api/sessions'; // Replace with your actual API endpoint
  
  // Time slots for session scheduling (8am to 6pm)
  timeSlots: TimeSlot[] = Array.from({ length: 11 }, (_, i) => ({
    id: i,
    time: `${i + 8}:00`
  }));
  
  // Days of the week
  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  constructor(
    // Remove HttpClient from constructor temporarily
    private timetableService: TimetableService
  ) { }

  // Create a new session in the current timetable
  createSession(sessionData: SessionRequest): Observable<TimetableSession> {
    // Format the session data
    const formattedSession: Omit<TimetableSession, 'id'> = {
      ...sessionData,
      color: this.getCategoryColor(sessionData.category || 'Lecture'),
      hasConflict: false
    };
    
    // Add the session to the timetable
    return this.timetableService.addSession(formattedSession);
  }

  // Update an existing session
  updateSession(session: TimetableSession): Observable<TimetableSession> {
    return this.timetableService.updateSession(session);
  }

  // Delete a session
  deleteSession(sessionId: number): Observable<boolean> {
    return this.timetableService.deleteSession(sessionId);
  }

  // Check if a venue is available at a specific time
  isVenueAvailable(venueId: string, day: string, timeSlot: string): Observable<boolean> {
    // Subscribe to the timetable sessions and check if the venue is available
    return new Observable<boolean>(observer => {
      this.timetableService.sessions$.subscribe(sessions => {
        const isBooked = sessions.some(session => 
          session.venueId === venueId && 
          session.day === day && 
          session.timeSlot === timeSlot
        );
        observer.next(!isBooked);
        observer.complete();
      });
    });
  }

  // Get sessions for a specific group
  getGroupSessions(groupId: number): Observable<TimetableSession[]> {
    return new Observable<TimetableSession[]>(observer => {
      this.timetableService.sessions$.subscribe(sessions => {
        const groupSessions = sessions.filter(session => session.groupId === groupId);
        observer.next(groupSessions);
        observer.complete();
      });
    });
  }

  // Get sessions for a specific lecturer
  getLecturerSessions(lecturerId: number): Observable<TimetableSession[]> {
    return new Observable<TimetableSession[]>(observer => {
      this.timetableService.sessions$.subscribe(sessions => {
        const lecturerSessions = sessions.filter(session => session.lecturerId === lecturerId);
        observer.next(lecturerSessions);
        observer.complete();
      });
    });
  }

  // Get sessions for a specific venue
  getVenueSessions(venueId: string): Observable<TimetableSession[]> {
    return new Observable<TimetableSession[]>(observer => {
      this.timetableService.sessions$.subscribe(sessions => {
        const venueSessions = sessions.filter(session => session.venueId === venueId);
        observer.next(venueSessions);
        observer.complete();
      });
    });
  }

  // Helper method to get color for a session category
  getCategoryColor(category: string): string {
    const colorMap: { [key: string]: string } = {
      'Lecture': '#4c8dff',
      'Lab': '#ffc409',
      'Tutorial': '#2dd36f',
      'Seminar': '#92949c',
      'Exam': '#eb445a'
    };
    return colorMap[category] || '#92949c';
  }

  // Convert day string to number (0-6)
  getDayIndex(day: string): number {
    const dayMap: { [key: string]: number } = {
      'Monday': 0,
      'Tuesday': 1,
      'Wednesday': 2,
      'Thursday': 3,
      'Friday': 4,
      'Saturday': 5,
      'Sunday': 6
    };
    return dayMap[day] || 0;
  }

  // Convert time string to slot number
  getTimeSlotIndex(time: string): number {
    const hour = parseInt(time.split(':')[0]);
    return hour - 8; // Assuming 8am is the first slot (slot 0)
  }

  // Format time slot for display
  formatTimeSlot(startSlot: number, endSlot: number): string {
    const startHour = startSlot + 8;
    const endHour = endSlot + 8;
    return `${startHour}:00 - ${endHour}:00`;
  }
}
