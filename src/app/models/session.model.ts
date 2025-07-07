export interface SessionForGrid {
  id: number;
  moduleId: number;
  moduleName: string;
  day: string;
  timeSlot: string;
  venueId: string; // Changed from number to string
  venue: string;
  lecturerId: number;
  lecturer: string;
  groupId: number;
  group: string;
  hasConflict: boolean;
}

export interface SessionForm {
  moduleId: number;
  moduleName: string;
  venueId: string; // Changed from number to string
  venue: string;
  lecturerId: number;
  lecturer: string;
  groupId: number;
  group: string;
  day: string;
  timeSlot: string;
  category: string;
  notes: string;
  departmentId: number;
}
