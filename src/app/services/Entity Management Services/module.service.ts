import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StaffService } from '../Data Services/staff.service';
import { AuthService } from '../Authentication Services/auth.service';
import * as XLSX from 'xlsx';

export interface Module {
  id: number;
  code: string;
  name: string;
  credits: number;
  sessionsPerWeek: number;
  groupCount: number;
  lecturerCount: number;
  lecturerIds: number[];
  department: string;
  program?: string;
  year?: string;
  electiveGroup?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  constructor(
    private staffService: StaffService,
    private authService: AuthService
  ) {}

  addModule(moduleData: Module): Observable<{ success: boolean; message: string }> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of({
        success: false,
        message: 'Unable to determine department. Please ensure you are logged in as an HOD.'
      });
    }

    return this.staffService.addModuleToDepartment(currentUser.department, moduleData);
  }

  processSpreadsheet(file: File): Observable<{ success: boolean; data?: Module[]; message: string }> {
    return new Observable(observer => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const modules = this.parseSpreadsheetData(jsonData as any[][]);

          if (modules.length === 0) {
            observer.next({
              success: false,
              message: 'No valid module data found in the spreadsheet'
            });
          } else {
            observer.next({
              success: true,
              data: modules,
              message: `Found ${modules.length} modules in the spreadsheet`
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

  private parseSpreadsheetData(data: any[][]): Module[] {
    if (data.length < 2) return [];

    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const modules: Module[] = [];

    const columnMappings = {
      code: ['code', 'module code', 'module_code', 'subjectcode', 'subject code'],
      name: ['name', 'module name', 'module_name', 'modulename', 'module name'],
      credits: ['credits', 'credit hours'],
      sessionsPerWeek: ['sessions per week', 'sessions_per_week', 'weekly sessions'],
      lecturerIds: ['lecturer ids', 'lecturer_ids', 'lecturers'],
      program: ['program', 'programme'],
      year: ['year'],
      electiveGroup: ['elective group', 'electivegroup', 'elective_group']
    };

    const columnIndices: { [key: string]: number } = {};
    Object.keys(columnMappings).forEach(field => {
      const possibleNames = columnMappings[field as keyof typeof columnMappings];
      const index = headers.findIndex(h => possibleNames.includes(h));
      if (index !== -1) {
        columnIndices[field] = index;
      }
    });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      try {
        const code = this.getCellValue(row, columnIndices['code']);
        const name = this.getCellValue(row, columnIndices['name']);

        if (!code || !name) {
          console.warn(`Skipping row ${i + 1}: Missing required fields`);
          continue;
        }

        const lecturerIdsString = this.getCellValue(row, columnIndices['lecturerIds']);
        const lecturerIds = lecturerIdsString ? lecturerIdsString.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

        const module: Module = {
          id: 0,
          code: String(code).trim(),
          name: String(name).trim(),
          credits: this.parseNumber(this.getCellValue(row, columnIndices['credits'])) || 10,
          sessionsPerWeek: this.parseNumber(this.getCellValue(row, columnIndices['sessionsPerWeek'])) || 1,
          groupCount: 0,
          lecturerCount: lecturerIds.length,
          lecturerIds: lecturerIds,
          department: '',
          program: this.getCellValue(row, columnIndices['program']),
          year: this.getCellValue(row, columnIndices['year']),
          electiveGroup: this.getCellValue(row, columnIndices['electiveGroup']),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        modules.push(module);
      } catch (error) {
        console.warn(`Error processing row ${i + 1}:`, error);
      }
    }

    return modules;
  }

  private getCellValue(row: any[], index: number): string {
    if (index === undefined || index < 0 || index >= row.length) return '';
    const value = row[index];
    return value !== null && value !== undefined ? String(value).trim() : '';
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  addModulesBulk(modules: Module[]): Observable<{ success: boolean; message: string; addedCount: number; errors: string[] }> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of({
        success: false,
        message: 'Unable to determine department. Please ensure you are logged in as an HOD.',
        addedCount: 0,
        errors: ['Authentication error']
      });
    }

    const modulesWithDept = modules.map(module => ({
      ...module,
      department: currentUser.department as string
    }));

    return this.staffService.addModulesToDepartment(currentUser.department, modulesWithDept);
  }

  getDepartmentModules(): Observable<Module[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.department) {
      return of([]);
    }

    return this.staffService.getModulesByDepartment(currentUser.department);
  }
}