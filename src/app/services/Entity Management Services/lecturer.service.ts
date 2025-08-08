import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StaffService } from '../Data Services/staff.service';
import { AuthService } from '../Authentication Services/auth.service';
import { User } from '../../components/add-user/add-user.component';
import * as XLSX from 'xlsx';
import { switchMap } from 'rxjs/operators';

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
    const currentUserObservable = this.authService.getCurrentUser();
    
    if (!currentUserObservable) {
      return of({
        success: false,
        message: 'No authenticated user found. Please ensure you are logged in as an HOD.'
      });
    }
    
    return currentUserObservable.pipe(
      switchMap(currentUser => {
        if (!currentUser || !currentUser.department) {
          return of({
            success: false,
            message: 'Unable to determine department. Please ensure you are logged in as an HOD and your department is properly configured.'
          });
        }
        
        return this.staffService.addLecturerToDepartment(currentUser.department, lecturerData);
      })
    );
  }
  
  // Process spreadsheet file and extract lecturer data
  processSpreadsheet(file: File): Observable<{ success: boolean, data?: User[], message: string }> {
    return new Observable(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let jsonData: any[][];
          
          // Check if it's a CSV file by file type or extension
          const isCSV = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
          
          if (isCSV) {
            // Handle CSV files with explicit comma delimiter
            const csvText = new TextDecoder('utf-8').decode(e.target?.result as ArrayBuffer);
            jsonData = this.parseCSVWithCommaDelimiter(csvText);
          } else {
            // Handle Excel files using XLSX
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { 
              type: 'array',
              // Configure XLSX to handle CSV with comma delimiter
              FS: ','  // Field separator
            });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              defval: '',  // Default value for empty cells
              blankrows: false  // Skip blank rows
            });
          }
          
          // Process the data
          const lecturers = this.parseSpreadsheetData(jsonData);
          
          if (lecturers.length === 0) {
            observer.next({
              success: false,
              message: 'No valid lecturer data found in the file. Please ensure your file has the required columns: unique_name, name, title, Sex, Email, deptName, Room Name, Schedulable, Weekly Target, Total Target'
            });
          } else {
            observer.next({
              success: true,
              data: lecturers,
              message: `Found ${lecturers.length} lecturers in the file`
            });
          }
        } catch (error) {
          observer.next({
            success: false,
            message: `Error processing file: ${error}. Please ensure your CSV file uses comma delimiters.`
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
  
  // Parse CSV text with explicit comma delimiter handling
  private parseCSVWithCommaDelimiter(csvText: string): any[][] {
    const lines = csvText.split(/\r?\n/);
    const result: any[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Parse CSV line with comma delimiter, handling quoted fields
      const row = this.parseCSVLine(line);
      if (row.length > 0) {
        result.push(row);
      }
    }
    
    return result;
  }
  
  // Parse a single CSV line, handling quoted fields and comma delimiters
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      const nextChar = i + 1 < line.length ? line[i + 1] : '';
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i += 2;
        } else {
          // Start or end of quoted field
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator (comma) outside of quotes
        result.push(current.trim());
        current = '';
        i++;
      } else {
        // Regular character
        current += char;
        i++;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  // Parse spreadsheet data into User objects
  private parseSpreadsheetData(data: any[][]): User[] {
    if (data.length < 2) return []; // Need at least header + 1 row
    
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const lecturers: User[] = [];
    
    // Define expected column mappings - updated to match template fields
    const columnMappings = {
      id: ['id', 'staff id', 'staff_id', 'lecturer id', 'lecturer_id', 'unique_name', 'unique name'],
      title: ['title', 'mr/ms/dr', 'salutation'],
      name: ['name', 'full name', 'lecturer name'],
      sex: ['sex', 'gender'],
      email: ['email', 'email address', 'contact email'],
      mobile: ['mobile', 'phone', 'mobile number', 'cell phone'],
      deptName: ['deptname', 'dept name', 'department', 'department name'],
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
        // Extract required fields with better error reporting
        const id = this.getCellValue(row, columnIndices['id']);
        const name = this.getCellValue(row, columnIndices['name']);
        const email = this.getCellValue(row, columnIndices['email']);
        const title = this.getCellValue(row, columnIndices['title']);
        const sex = this.getCellValue(row, columnIndices['sex']);
        
        // Debug logging for troubleshooting
        console.log(`Row ${i + 1} data:`, {
          id, name, email, title, sex,
          rowLength: row.length,
          columnIndices,
          rawRow: row
        });
        
        // Skip rows without required fields - be more specific about what's missing
        const missingFields = [];
        if (!id) missingFields.push('unique_name/id');
        if (!name) missingFields.push('name');
        if (!email) missingFields.push('email');
        if (!title) missingFields.push('title');
        if (!sex) missingFields.push('sex');
        
        if (missingFields.length > 0) {
          console.warn(`Skipping row ${i + 1}: Missing required fields: ${missingFields.join(', ')}`);
          console.warn(`Available headers:`, headers);
          console.warn(`Column indices:`, columnIndices);
          continue;
        }
        
        const lecturer: User = {
          id: String(id).trim(),
          title: String(title).trim() || 'MR',
          name: String(name).trim(),
          sex: String(sex).trim().toUpperCase(),
          department: this.getCellValue(row, columnIndices['deptName']) || '', // Will be overridden by service
          roomName: this.getCellValue(row, columnIndices['roomName']) || '',
          role: 'Lecturer',
          schedulable: this.parseBoolean(this.getCellValue(row, columnIndices['schedulable'])) !== false, // Default to true if not specified
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
    const currentUserObservable = this.authService.getCurrentUser();
    
    if (!currentUserObservable) {
      return of({
        success: false,
        message: 'No authenticated user found. Please ensure you are logged in as an HOD.',
        addedCount: 0,
        errors: ['Authentication error']
      });
    }
    
    return currentUserObservable.pipe(
      switchMap(currentUser => {
        if (!currentUser || !currentUser.department) {
          return of({
            success: false,
            message: 'Unable to determine department. Please ensure you are logged in as an HOD and your department is properly configured.',
            addedCount: 0,
            errors: ['Authentication error']
          });
        }
        
        // Set department for all lecturers
        const lecturersWithDept = lecturers.map(lecturer => ({
          ...lecturer,
          department: currentUser.department as string
        }));
        
        return this.staffService.addLecturersToDepartment(currentUser.department, lecturersWithDept);
      })
    );
  }
  
  // Get all lecturers for the current HOD's department
  getDepartmentLecturers(): Observable<User[]> {
    const currentUserObservable = this.authService.getCurrentUser();
    
    if (!currentUserObservable) {
      return of([]);
    }
    
    return currentUserObservable.pipe(
      switchMap(currentUser => {
        if (!currentUser || !currentUser.department) {
          return of([]);
        }
        
        return this.staffService.getLecturersByDepartment(currentUser.department);
      })
    );
  }
}
