import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StaffService } from '../Data Services/staff.service';
import { AuthService } from '../Authentication Services/auth.service';
import { User } from '../../components/add-user/add-user.component';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class LecturerService {

  constructor(
    private staffService: StaffService,
    private authService: AuthService
  ) { }
  
  // Add a single lecturer to the HOD's department
  addLecturer(lecturerData: User): Observable<{ success: boolean, message: string }> {
    // Get current user's department (assuming HOD is logged in)
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of({
        success: false,
        message: 'Unable to determine department. Please ensure you are logged in as an HOD.'
      });
    }
    
    return this.staffService.addLecturerToDepartment(currentUser.department, lecturerData);
  }
  
  // Process spreadsheet file and extract lecturer data
  processSpreadsheet(file: File): Observable<{ success: boolean, data?: User[], message: string }> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Process the data
          const lecturers = this.parseSpreadsheetData(jsonData as any[][]);
          
          if (lecturers.length === 0) {
            observer.next({
              success: false,
              message: 'No valid lecturer data found in the spreadsheet'
            });
          } else {
            observer.next({
              success: true,
              data: lecturers,
              message: `Found ${lecturers.length} lecturers in the spreadsheet`
            });
          }
        } catch (error) {
          observer.next({
            success: false,
            message: `Error processing file: ${error}`
          });
        }
        observer.complete();
      };
      
      reader.onerror = () => {
        observer.next({
          success: false,
          message: 'Error reading file'
        });
        observer.complete();
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Parse spreadsheet data into User objects
  private parseSpreadsheetData(data: any[][]): User[] {
    if (data.length < 2) return []; // Need at least header + 1 row
    
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const lecturers: User[] = [];
    
    // Define expected column mappings
    const columnMappings = {
      id: ['id', 'staff id', 'staff_id', 'lecturer id', 'lecturer_id'],
      title: ['title', 'mr/ms/dr', 'salutation'],
      name: ['name', 'full name', 'lecturer name'],
      sex: ['sex', 'gender'],
      email: ['email', 'email address', 'contact email'],
      mobile: ['mobile', 'phone', 'mobile number', 'cell phone'],
      roomName: ['room', 'office', 'room name', 'office number'],
      schedulable: ['schedulable', 'can schedule', 'available'],
      weeklyTarget: ['weekly target', 'weekly hours', 'hours per week'],
      totalTarget: ['total target', 'total hours', 'semester hours']
    };
    
    // Find column indices
    const columnIndices: { [key: string]: number } = {};
    Object.keys(columnMappings).forEach(field => {
      const possibleNames = columnMappings[field as keyof typeof columnMappings];
      const index = headers.findIndex(h => possibleNames.includes(h));
      if (index !== -1) {
        columnIndices[field] = index;
      }
    });
    
    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      try {
        // Extract required fields
        const id = this.getCellValue(row, columnIndices['id']);
        const name = this.getCellValue(row, columnIndices['name']);
        const email = this.getCellValue(row, columnIndices['email']);
        
        // Skip rows without required fields
        if (!id || !name || !email) {
          console.warn(`Skipping row ${i + 1}: Missing required fields`);
          continue;
        }
        
        const lecturer: User = {
          id: String(id).trim(),
          title: this.getCellValue(row, columnIndices['title']) || 'MR',
          name: String(name).trim(),
          sex: this.getCellValue(row, columnIndices['sex']) || '',
          department: '', // Will be set by the service
          roomName: this.getCellValue(row, columnIndices['roomName']) || '',
          role: 'Lecturer',
          schedulable: this.parseBoolean(this.getCellValue(row, columnIndices['schedulable'])) || false,
          contact: {
            email: String(email).trim(),
            mobile: this.getCellValue(row, columnIndices['mobile']) || ''
          },
          accessibility: {
            deafLoop: false,
            wheelchairAccess: false
          },
          weeklyTarget: this.parseNumber(this.getCellValue(row, columnIndices['weeklyTarget'])) || 0,
          totalTarget: this.parseNumber(this.getCellValue(row, columnIndices['totalTarget'])) || 0
        };
        
        lecturers.push(lecturer);
      } catch (error) {
        console.warn(`Error processing row ${i + 1}:`, error);
      }
    }
    
    return lecturers;
  }
  
  // Helper method to get cell value safely
  private getCellValue(row: any[], index: number): string {
    if (index === undefined || index < 0 || index >= row.length) return '';
    const value = row[index];
    return value !== null && value !== undefined ? String(value).trim() : '';
  }
  
  // Helper method to parse boolean values
  private parseBoolean(value: string): boolean {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'y';
  }
  
  // Helper method to parse numeric values
  private parseNumber(value: string): number {
    if (!value) return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  
  // Bulk add lecturers to department
  addLecturersBulk(lecturers: User[]): Observable<{ success: boolean, message: string, addedCount: number, errors: string[] }> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of({
        success: false,
        message: 'Unable to determine department. Please ensure you are logged in as an HOD.',
        addedCount: 0,
        errors: ['Authentication error']
      });
    }
    
    // Set department for all lecturers and ensure it's never null
    const lecturersWithDept = lecturers.map(lecturer => ({
      ...lecturer,
      department: currentUser.department as string // Cast to string since we've checked it's not null above
    }));
    
    return this.staffService.addLecturersToDepartment(currentUser.department, lecturersWithDept);
  }
  
  // Get all lecturers for the current HOD's department
  getDepartmentLecturers(): Observable<User[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of([]);
    }
    
    return this.staffService.getLecturersByDepartment(currentUser.department);
  }
}
