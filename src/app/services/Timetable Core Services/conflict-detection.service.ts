import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TimetableSession } from './timetable.service';

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: SessionConflict[];
  conflictingSessions: TimetableSession[];
}

export interface SessionConflict {
  id: string;
  type: 'venue' | 'lecturer' | 'group' | 'time';
  severity: 'high' | 'medium' | 'low';
  sessions: TimetableSession[];
  description: string;
  suggestedResolutions: ConflictResolution[];
}

export interface ConflictResolution {
  id: string;
  type: 'relocate' | 'reschedule' | 'reassign';
  description: string;
  newVenueId?: string;
  newVenue?: string;
  newDay?: string;
  newTimeSlot?: string;
  newLecturerId?: number;
  newLecturer?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConflictDetectionService {

  constructor() { }

  // Main conflict detection method
  detectConflicts(sessions: TimetableSession[]): Observable<ConflictResult> {
    const conflicts: SessionConflict[] = [];
    const conflictingSessionIds = new Set<number>();

    // Detect venue conflicts
    const venueConflicts = this.detectVenueConflicts(sessions);
    conflicts.push(...venueConflicts);
    venueConflicts.forEach(conflict => {
      conflict.sessions.forEach(session => conflictingSessionIds.add(session.id));
    });

    // Detect lecturer conflicts
    const lecturerConflicts = this.detectLecturerConflicts(sessions);
    conflicts.push(...lecturerConflicts);
    lecturerConflicts.forEach(conflict => {
      conflict.sessions.forEach(session => conflictingSessionIds.add(session.id));
    });

    // Detect group conflicts
    const groupConflicts = this.detectGroupConflicts(sessions);
    conflicts.push(...groupConflicts);
    groupConflicts.forEach(conflict => {
      conflict.sessions.forEach(session => conflictingSessionIds.add(session.id));
    });

    // Get all conflicting sessions
    const conflictingSessions = sessions.filter(session => 
      conflictingSessionIds.has(session.id)
    );

    // Mark sessions as having conflicts
    sessions.forEach(session => {
      session.hasConflict = conflictingSessionIds.has(session.id);
    });

    const result: ConflictResult = {
      hasConflicts: conflicts.length > 0,
      conflicts,
      conflictingSessions
    };

    return of(result);
  }

  // Detect venue conflicts (same venue, same time)
  private detectVenueConflicts(sessions: TimetableSession[]): SessionConflict[] {
    const conflicts: SessionConflict[] = [];
    const venueTimeMap = new Map<string, TimetableSession[]>();

    // Group sessions by venue and time
    sessions.forEach(session => {
      const key = `${session.venueId}-${session.day}-${session.timeSlot}`;
      if (!venueTimeMap.has(key)) {
        venueTimeMap.set(key, []);
      }
      venueTimeMap.get(key)!.push(session);
    });

    // Find conflicts
    venueTimeMap.forEach((venueSessions, key) => {
      if (venueSessions.length > 1) {
        const conflict: SessionConflict = {
          id: `venue-${key}`,
          type: 'venue',
          severity: 'high',
          sessions: venueSessions,
          description: `${venueSessions[0].venue} is double-booked on ${venueSessions[0].day} at ${venueSessions[0].timeSlot}`,
          suggestedResolutions: this.generateVenueResolutions(venueSessions)
        };
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  // Detect lecturer conflicts (same lecturer, same time)
  private detectLecturerConflicts(sessions: TimetableSession[]): SessionConflict[] {
    const conflicts: SessionConflict[] = [];
    const lecturerTimeMap = new Map<string, TimetableSession[]>();

    // Group sessions by lecturer and time
    sessions.forEach(session => {
      const key = `${session.lecturerId}-${session.day}-${session.timeSlot}`;
      if (!lecturerTimeMap.has(key)) {
        lecturerTimeMap.set(key, []);
      }
      lecturerTimeMap.get(key)!.push(session);
    });

    // Find conflicts
    lecturerTimeMap.forEach((lecturerSessions, key) => {
      if (lecturerSessions.length > 1) {
        const conflict: SessionConflict = {
          id: `lecturer-${key}`,
          type: 'lecturer',
          severity: 'medium',
          sessions: lecturerSessions,
          description: `${lecturerSessions[0].lecturer} is scheduled for multiple sessions on ${lecturerSessions[0].day} at ${lecturerSessions[0].timeSlot}`,
          suggestedResolutions: this.generateLecturerResolutions(lecturerSessions)
        };
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  // Detect group conflicts (same group, same time)
  private detectGroupConflicts(sessions: TimetableSession[]): SessionConflict[] {
    const conflicts: SessionConflict[] = [];
    const groupTimeMap = new Map<string, TimetableSession[]>();

    // Group sessions by group and time
    sessions.forEach(session => {
      const key = `${session.groupId}-${session.day}-${session.timeSlot}`;
      if (!groupTimeMap.has(key)) {
        groupTimeMap.set(key, []);
      }
      groupTimeMap.get(key)!.push(session);
    });

    // Find conflicts
    groupTimeMap.forEach((groupSessions, key) => {
      if (groupSessions.length > 1) {
        const conflict: SessionConflict = {
          id: `group-${key}`,
          type: 'group',
          severity: 'high',
          sessions: groupSessions,
          description: `${groupSessions[0].group} has multiple sessions scheduled on ${groupSessions[0].day} at ${groupSessions[0].timeSlot}`,
          suggestedResolutions: this.generateGroupResolutions(groupSessions)
        };
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  // Generate resolution suggestions for venue conflicts
  private generateVenueResolutions(sessions: TimetableSession[]): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    // Suggest venue relocation
    resolutions.push({
      id: `relocate-${sessions[0].id}`,
      type: 'relocate',
      description: `Move ${sessions[1].moduleName} to a different venue`,
      newVenue: 'Alternative Venue' // In real app, suggest actual available venues
    });

    // Suggest rescheduling
    resolutions.push({
      id: `reschedule-${sessions[0].id}`,
      type: 'reschedule',
      description: `Reschedule ${sessions[1].moduleName} to a different time`,
      newDay: sessions[0].day,
      newTimeSlot: 'Alternative Time Slot' // In real app, suggest actual available times
    });

    return resolutions;
  }

  // Generate resolution suggestions for lecturer conflicts
  private generateLecturerResolutions(sessions: TimetableSession[]): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    // Suggest rescheduling
    resolutions.push({
      id: `reschedule-lecturer-${sessions[0].id}`,
      type: 'reschedule',
      description: `Reschedule ${sessions[1].moduleName} to avoid lecturer conflict`,
      newDay: 'Alternative Day',
      newTimeSlot: 'Alternative Time Slot'
    });

    // Suggest lecturer reassignment
    resolutions.push({
      id: `reassign-${sessions[0].id}`,
      type: 'reassign',
      description: `Assign a different lecturer to ${sessions[1].moduleName}`,
      newLecturer: 'Alternative Lecturer'
    });

    return resolutions;
  }

  // Generate resolution suggestions for group conflicts
  private generateGroupResolutions(sessions: TimetableSession[]): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    // Suggest rescheduling
    resolutions.push({
      id: `reschedule-group-${sessions[0].id}`,
      type: 'reschedule',
      description: `Reschedule ${sessions[1].moduleName} to avoid group conflict`,
      newDay: 'Alternative Day',
      newTimeSlot: 'Alternative Time Slot'
    });

    return resolutions;
  }

  // Check if a specific venue is available at a given time
  checkVenueAvailability(
    venueId: string, 
    day: string, 
    timeSlot: string, 
    sessions: TimetableSession[],
    excludeSessionId?: number
  ): boolean {
    return !sessions.some(session => 
      session.venueId === venueId && 
      session.day === day && 
      session.timeSlot === timeSlot &&
      session.id !== excludeSessionId
    );
  }

  // Check if a specific lecturer is available at a given time
  checkLecturerAvailability(
    lecturerId: number, 
    day: string, 
    timeSlot: string, 
    sessions: TimetableSession[],
    excludeSessionId?: number
  ): boolean {
    return !sessions.some(session => 
      session.lecturerId === lecturerId && 
      session.day === day && 
      session.timeSlot === timeSlot &&
      session.id !== excludeSessionId
    );
  }

  // Check if a specific group is available at a given time
  checkGroupAvailability(
    groupId: number, 
    day: string, 
    timeSlot: string, 
    sessions: TimetableSession[],
    excludeSessionId?: number
  ): boolean {
    return !sessions.some(session => 
      session.groupId === groupId && 
      session.day === day && 
      session.timeSlot === timeSlot &&
      session.id !== excludeSessionId
    );
  }
}
