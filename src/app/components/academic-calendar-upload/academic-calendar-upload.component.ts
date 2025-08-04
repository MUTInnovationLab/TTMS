import { Component, OnInit, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ToastController, AlertController, ModalController } from '@ionic/angular';

export interface AcademicCalendarData {
  academicYear: number;
  universityOpenDate: Date;
  universityCloseDate: Date;
  semesters: AcademicSemester[];
  weeks: AcademicWeek[];
  examPeriods: ExamPeriod[];
  breaks: BreakPeriod[];
  specialEvents: SpecialEvent[];
  graduationCeremonies: GraduationCeremony[];
}

export interface AcademicSemester {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  terms: AcademicTerm[];
}

export interface AcademicTerm {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  semesterNumber: number;
}

export interface AcademicWeek {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  type: 'academic' | 'exam' | 'break' | 'holiday' | 'pre-academic' | 'post-academic';
  label: string;
  description?: string;
  events: WeekEvent[];
}

export interface ExamPeriod {
  id: string;
  name: string;
  type: 'semester1' | 'semester2' | 'annual' | 'supplementary';
  startDate: Date;
  endDate: Date;
  weeks: number[];
}

export interface BreakPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  weeks: number[];
}

export interface SpecialEvent {
  id: string;
  name: string;
  date: Date;
  type: 'holiday' | 'graduation' | 'registration' | 'committee' | 'academic' | 'exam';
  description?: string;
}

export interface GraduationCeremony {
  faculty: string;
  session: string;
  date: Date;
  time: string;
}

export interface WeekEvent {
  date: Date;
  title: string;
  type: 'holiday' | 'academic' | 'committee' | 'exam' | 'registration' | 'graduation';
  description?: string;
}

@Component({
  selector: 'app-academic-calendar-upload',
  templateUrl: './academic-calendar-upload.component.html',
  styleUrls: ['./academic-calendar-upload.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AcademicCalendarUploadComponent implements OnInit, OnDestroy {
  @Output() calendarUploaded = new EventEmitter<AcademicCalendarData>();
  @Output() closeModal = new EventEmitter<void>();

  uploadStep: 'upload' | 'preview' | 'configure' = 'upload';
  selectedFile: File | null = null;
  uploadProgress = 0;
  isUploading = false;
  
  // Component state management
  private isDestroyed = false;
  private isModalDismissing = false;
  
  // Parsed calendar data
  parsedCalendar: AcademicCalendarData | null = null;
  previewData: any[] = [];
  
  // Configuration options
  calendarConfig = {
    academicYear: new Date().getFullYear(),
    timeZone: 'Africa/Johannesburg',
    weekStartsOn: 'monday' as 'monday' | 'sunday',
    includeWeekends: true,
    autoDetectHolidays: true
  };

  // File format options
  supportedFormats = [
    { 
      format: 'txt', 
      description: 'Plain text calendar (MUT format) - Month headers, week blocks, and daily events',
      example: 'JANUARY\n[Week 1]\nWednesday 01: Public Holiday - New Year\'s Day\n[Week 2]\nMonday 06: University re-opens\n...'
    },
    { 
      format: 'csv', 
      description: 'CSV spreadsheet with structured data - Date, Week, Event, Type, Description columns',
      example: '2025-01-01,1,Public Holiday - New Year\'s Day,holiday,National public holiday\n2025-01-06,2,University re-opens,academic,Start of academic year'
    },
    { 
      format: 'json', 
      description: 'JSON structured data with complete calendar information including semesters, weeks, exams, and events',
      example: '{"academicYear": 2025, "weeks": [...], "examPeriods": [...], "specialEvents": [...]}'
    }
  ];

  // Error handling
  errors: string[] = [];
  warnings: string[] = [];

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.isDestroyed = false;
    this.isModalDismissing = false;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.cleanup();
  }

  private cleanup() {
    // Clean up any references and reset state
    this.selectedFile = null;
    this.parsedCalendar = null;
    this.previewData = [];
    this.errors = [];
    this.warnings = [];
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = ['txt', 'csv', 'json'];
    
    if (!supportedExtensions.includes(fileExtension || '')) {
      this.showError('Unsupported file format. Please use TXT, CSV, or JSON files.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showError('File too large. Maximum size is 5MB.');
      return;
    }

    this.selectedFile = file;
    this.errors = [];
    this.warnings = [];
  }

  async uploadCalendar() {
    if (!this.selectedFile) {
      this.showError('Please select a file first.');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      // Read file content
      const fileContent = await this.readFileContent(this.selectedFile);
      this.uploadProgress = 30;

      // Parse calendar based on file type
      const fileExtension = this.selectedFile.name.split('.').pop()?.toLowerCase();
      let parsedData: AcademicCalendarData;

      switch (fileExtension) {
        case 'txt':
          parsedData = await this.parsePlainTextCalendar(fileContent);
          break;
        case 'csv':
          parsedData = await this.parseCSVCalendar(fileContent);
          break;
        case 'json':
          parsedData = await this.parseJSONCalendar(fileContent);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      this.uploadProgress = 70;

      // Validate parsed data
      this.validateCalendarData(parsedData);
      this.uploadProgress = 90;

      // Generate preview data
      this.generatePreviewData(parsedData);
      this.parsedCalendar = parsedData;
      
      this.uploadProgress = 100;
      this.uploadStep = 'preview';
      
      this.showSuccess(`Calendar parsed successfully! Found ${parsedData.weeks.length} weeks and ${parsedData.specialEvents.length} events.`);

    } catch (error: any) {
      console.error('Calendar upload error:', error);
      this.showError(`Failed to parse calendar: ${error.message}`);
    } finally {
      this.isUploading = false;
    }
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private async parsePlainTextCalendar(content: string): Promise<AcademicCalendarData> {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    const calendar: AcademicCalendarData = {
      academicYear: this.calendarConfig.academicYear,
      universityOpenDate: new Date(),
      universityCloseDate: new Date(),
      semesters: [],
      weeks: [],
      examPeriods: [],
      breaks: [],
      specialEvents: [],
      graduationCeremonies: []
    };

    let currentMonth = '';
    let currentWeek = 0;
    let currentWeekStart: Date | null = null;
    const weekEvents: WeekEvent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect month headers
      if (this.isMonthHeader(line)) {
        currentMonth = line.toUpperCase();
        continue;
      }

      // Detect week markers [Week X]
      const weekMatch = line.match(/\[Week (\d+)\]/);
      if (weekMatch) {
        // Save previous week if exists
        if (currentWeek > 0 && currentWeekStart) {
          this.addWeekToCalendar(calendar, currentWeek, currentWeekStart, weekEvents.slice());
          weekEvents.length = 0; // Clear events for next week
        }
        
        currentWeek = parseInt(weekMatch[1]);
        continue;
      }

      // Parse daily events
      const eventMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}):\s*(.+)$/);
      if (eventMatch && currentMonth) {
        const [, dayName, dayNumber, eventText] = eventMatch;
        const eventDate = this.parseDate(currentMonth, parseInt(dayNumber), this.calendarConfig.academicYear);
        
        if (!currentWeekStart && dayName === 'Monday') {
          currentWeekStart = eventDate;
        }

        // Parse special events
        this.parseSpecialEvent(calendar, eventDate, eventText, line);
        
        // Add to week events
        weekEvents.push({
          date: eventDate,
          title: eventText,
          type: this.categorizeEvent(eventText),
          description: eventText
        });
      }
    }

    // Add final week
    if (currentWeek > 0 && currentWeekStart) {
      this.addWeekToCalendar(calendar, currentWeek, currentWeekStart, weekEvents);
    }

    // Post-processing
    this.detectSemesters(calendar);
    this.detectExamPeriods(calendar);
    this.detectBreaks(calendar);
    this.setUniversityDates(calendar);

    return calendar;
  }

  private parseCSVCalendar(content: string): Promise<AcademicCalendarData> {
    return new Promise((resolve, reject) => {
      try {
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('CSV file must contain at least a header and one data row');
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const expectedColumns = ['date', 'week', 'event', 'type', 'description'];
        
        // Validate header
        for (const col of expectedColumns) {
          if (!header.includes(col)) {
            throw new Error(`Missing required column: ${col}`);
          }
        }

        // Get column indices
        const dateIndex = header.indexOf('date');
        const weekIndex = header.indexOf('week');
        const eventIndex = header.indexOf('event');
        const typeIndex = header.indexOf('type');
        const descriptionIndex = header.indexOf('description');

        const calendar: AcademicCalendarData = {
          academicYear: new Date().getFullYear(),
          universityOpenDate: new Date(),
          universityCloseDate: new Date(),
          semesters: [],
          weeks: [],
          specialEvents: [],
          examPeriods: [],
          breaks: [],
          graduationCeremonies: []
        };

        const processedWeeks = new Set<number>();
        let earliestDate = '';

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          const columns = this.parseCSVLine(line);
          if (columns.length < expectedColumns.length) {
            console.warn(`Skipping invalid row ${i + 1}: insufficient columns`);
            continue;
          }

          const date = columns[dateIndex]?.trim();
          const weekNum = parseInt(columns[weekIndex]?.trim());
          const event = columns[eventIndex]?.trim();
          const type = columns[typeIndex]?.trim().toLowerCase();
          const description = columns[descriptionIndex]?.trim();

          // Validate date format
          if (!this.isValidDate(date)) {
            console.warn(`Skipping row ${i + 1}: invalid date format ${date}`);
            continue;
          }

          // Set university open date (first academic event)
          if (type === 'academic' && !calendar.universityOpenDate) {
            calendar.universityOpenDate = new Date(date);
          }

          // Track earliest date
          if (!earliestDate || date < earliestDate) {
            earliestDate = date;
          }

          // Create week entry if not exists
          if (!processedWeeks.has(weekNum)) {
            const weekStartDate = this.getWeekStartDate(date, weekNum);
            calendar.weeks.push({
              weekNumber: weekNum,
              startDate: new Date(weekStartDate),
              endDate: new Date(this.getWeekEndDate(weekStartDate)),
              type: 'academic', // Default type, will be updated based on events
              label: `Week ${weekNum}`,
              events: []
            });
            processedWeeks.add(weekNum);
          }

          // Categorize events
          switch (type) {
            case 'holiday':
              calendar.specialEvents.push({
                id: this.generateId(),
                name: event,
                date: new Date(date),
                description: description || event,
                type: 'holiday'
              });
              break;

            case 'exam':
              // Group exam periods
              const existingExamPeriod = calendar.examPeriods.find(ep => 
                ep.name.toLowerCase().includes(event.toLowerCase()) ||
                event.toLowerCase().includes(ep.name.toLowerCase())
              );
              
              if (existingExamPeriod) {
                // Extend existing exam period
                const eventDate = new Date(date);
                if (eventDate < existingExamPeriod.startDate) existingExamPeriod.startDate = eventDate;
                if (eventDate > existingExamPeriod.endDate) existingExamPeriod.endDate = eventDate;
              } else {
                calendar.examPeriods.push({
                  id: this.generateId(),
                  name: event,
                  type: this.determineExamType(event),
                  startDate: new Date(date),
                  endDate: new Date(date),
                  weeks: [weekNum]
                });
              }
              break;

            case 'break':
              // Group break periods
              const existingBreak = calendar.breaks.find(bp => 
                bp.name.toLowerCase().includes(event.toLowerCase()) ||
                event.toLowerCase().includes(bp.name.toLowerCase())
              );
              
              if (existingBreak) {
                // Extend existing break period
                const eventDate = new Date(date);
                if (eventDate < existingBreak.startDate) existingBreak.startDate = eventDate;
                if (eventDate > existingBreak.endDate) existingBreak.endDate = eventDate;
                if (!existingBreak.weeks.includes(weekNum)) {
                  existingBreak.weeks.push(weekNum);
                }
              } else {
                calendar.breaks.push({
                  id: this.generateId(),
                  name: event,
                  startDate: new Date(date),
                  endDate: new Date(date),
                  weeks: [weekNum]
                });
              }
              break;

            case 'academic':
            case 'registration':
            case 'committee':
            default:
              calendar.specialEvents.push({
                id: this.generateId(),
                name: event,
                date: new Date(date),
                description: description || event,
                type: type === 'exam' ? 'exam' : (type === 'registration' ? 'registration' : 'academic')
              });
              break;
          }
        }

        // Set university open date if not set
        if (!calendar.universityOpenDate && earliestDate) {
          calendar.universityOpenDate = new Date(earliestDate);
        }

        // Extract academic year from dates
        if (calendar.weeks.length > 0) {
          const firstDate = calendar.weeks[0].startDate;
          calendar.academicYear = firstDate.getFullYear();
        }

        // Sort arrays
        calendar.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
        calendar.specialEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        calendar.examPeriods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        calendar.breaks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        resolve(calendar);
      } catch (error: any) {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  }

  private parseJSONCalendar(content: string): Promise<AcademicCalendarData> {
    try {
      return Promise.resolve(JSON.parse(content));
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  private isMonthHeader(line: string): boolean {
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                   'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return months.includes(line.toUpperCase());
  }

  private parseDate(month: string, day: number, year: number): Date {
    const monthIndex = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                       'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
                       .indexOf(month.toUpperCase());
    return new Date(year, monthIndex, day);
  }

  private categorizeEvent(eventText: string): 'holiday' | 'academic' | 'committee' | 'exam' | 'registration' | 'graduation' {
    const text = eventText.toLowerCase();
    
    if (text.includes('public holiday') || text.includes('holiday')) return 'holiday';
    if (text.includes('exam') || text.includes('examination')) return 'exam';
    if (text.includes('registration') || text.includes('register')) return 'registration';
    if (text.includes('committee') || text.includes('meeting')) return 'committee';
    if (text.includes('graduation') || text.includes('ceremony')) return 'graduation';
    
    return 'academic';
  }

  private parseSpecialEvent(calendar: AcademicCalendarData, date: Date, eventText: string, fullLine: string) {
    // Extract university open/close dates
    if (eventText.includes('University re-opens') || eventText.includes('University Opens')) {
      calendar.universityOpenDate = date;
    }
    if (eventText.includes('University closes') || eventText.includes('University Closes')) {
      calendar.universityCloseDate = date;
    }

    // Extract graduation ceremonies
    if (eventText.includes('Graduation Ceremony')) {
      const graduationMatch = eventText.match(/Graduation Ceremony:\s*(.+?)\s*\((.+?)\)/);
      if (graduationMatch) {
        calendar.graduationCeremonies.push({
          faculty: graduationMatch[1],
          session: graduationMatch[2],
          date: date,
          time: graduationMatch[2]
        });
      }
    }

    // Add to special events
    calendar.specialEvents.push({
      id: `event_${date.getTime()}`,
      name: eventText,
      date: date,
      type: this.categorizeEvent(eventText),
      description: fullLine
    });
  }

  private addWeekToCalendar(calendar: AcademicCalendarData, weekNumber: number, startDate: Date, events: WeekEvent[]) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const weekType = this.determineWeekType(events);
    const weekLabel = this.generateWeekLabel(weekNumber, weekType, events);

    calendar.weeks.push({
      weekNumber,
      startDate: new Date(startDate),
      endDate,
      type: weekType,
      label: weekLabel,
      description: this.generateWeekDescription(events),
      events: [...events]
    });
  }

  private determineWeekType(events: WeekEvent[]): 'academic' | 'exam' | 'break' | 'holiday' | 'pre-academic' | 'post-academic' {
    const eventTypes = events.map(e => e.type);
    
    if (eventTypes.includes('exam')) return 'exam';
    if (events.some(e => e.title.toLowerCase().includes('break') || e.title.toLowerCase().includes('recess'))) return 'break';
    if (eventTypes.includes('holiday')) return 'holiday';
    if (events.some(e => e.title.toLowerCase().includes('lecture') || e.title.toLowerCase().includes('academic'))) return 'academic';
    
    return 'academic'; // Default
  }

  private generateWeekLabel(weekNumber: number, type: string, events: WeekEvent[]): string {
    const significantEvent = events.find(e => 
      e.title.includes('commence') || 
      e.title.includes('begin') || 
      e.title.includes('end') ||
      e.title.includes('examination')
    );

    if (significantEvent) {
      return `Week ${weekNumber} (${significantEvent.title})`;
    }

    return `Week ${weekNumber} (${type.charAt(0).toUpperCase() + type.slice(1)})`;
  }

  private generateWeekDescription(events: WeekEvent[]): string {
    const significantEvents = events.filter(e => 
      !e.title.toLowerCase().includes('committee') &&
      !e.title.toLowerCase().includes('meeting')
    );
    
    return significantEvents.map(e => e.title).join('; ');
  }

  private detectSemesters(calendar: AcademicCalendarData) {
    // Find semester start/end from events
    const semesterEvents = calendar.specialEvents.filter(e => 
      e.name.toLowerCase().includes('semester') || 
      e.name.toLowerCase().includes('term')
    );

    // Create semesters based on detected patterns
    // This would need more sophisticated logic based on the actual calendar content
  }

  private detectExamPeriods(calendar: AcademicCalendarData) {
    const examWeeks = calendar.weeks.filter(w => w.type === 'exam');
    
    // Group consecutive exam weeks into periods
    let currentPeriod: number[] = [];
    let periods: ExamPeriod[] = [];

    examWeeks.forEach((week, index) => {
      if (currentPeriod.length === 0) {
        currentPeriod = [week.weekNumber];
      } else if (week.weekNumber === currentPeriod[currentPeriod.length - 1] + 1) {
        currentPeriod.push(week.weekNumber);
      } else {
        // End of current period, start new one
        if (currentPeriod.length > 0) {
          periods.push(this.createExamPeriod(currentPeriod, calendar));
        }
        currentPeriod = [week.weekNumber];
      }
    });

    // Add final period
    if (currentPeriod.length > 0) {
      periods.push(this.createExamPeriod(currentPeriod, calendar));
    }

    calendar.examPeriods = periods;
  }

  private createExamPeriod(weekNumbers: number[], calendar: AcademicCalendarData): ExamPeriod {
    const weeks = calendar.weeks.filter(w => weekNumbers.includes(w.weekNumber));
    const startDate = weeks[0].startDate;
    const endDate = weeks[weeks.length - 1].endDate;
    
    // Determine exam type based on timing
    let type: 'semester1' | 'semester2' | 'annual' | 'supplementary' = 'semester1';
    if (weekNumbers[0] > 40) type = 'semester2';
    else if (weekNumbers[0] > 20 && weekNumbers[0] < 30) type = 'annual';
    
    return {
      id: `exam_${weekNumbers[0]}_${weekNumbers[weekNumbers.length - 1]}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Examinations`,
      type,
      startDate,
      endDate,
      weeks: weekNumbers
    };
  }

  private detectBreaks(calendar: AcademicCalendarData) {
    const breakWeeks = calendar.weeks.filter(w => w.type === 'break');
    
    // Similar logic to exam periods but for breaks
    calendar.breaks = breakWeeks.map(week => ({
      id: `break_${week.weekNumber}`,
      name: week.label,
      startDate: week.startDate,
      endDate: week.endDate,
      weeks: [week.weekNumber]
    }));
  }

  private setUniversityDates(calendar: AcademicCalendarData) {
    // Set dates based on parsed events if not already set
    if (!calendar.universityOpenDate || calendar.universityOpenDate.getTime() === new Date().getTime()) {
      const openEvent = calendar.specialEvents.find(e => 
        e.name.toLowerCase().includes('university') && 
        e.name.toLowerCase().includes('open')
      );
      if (openEvent) calendar.universityOpenDate = openEvent.date;
    }

    if (!calendar.universityCloseDate || calendar.universityCloseDate.getTime() === new Date().getTime()) {
      const closeEvent = calendar.specialEvents.find(e => 
        e.name.toLowerCase().includes('university') && 
        e.name.toLowerCase().includes('close')
      );
      if (closeEvent) calendar.universityCloseDate = closeEvent.date;
    }
  }

  private validateCalendarData(data: AcademicCalendarData) {
    this.errors = [];
    this.warnings = [];

    // Basic validation
    if (!data.weeks || data.weeks.length === 0) {
      this.errors.push('No weeks found in calendar data');
    }

    if (!data.universityOpenDate || !data.universityCloseDate) {
      this.warnings.push('University open/close dates not found - using defaults');
    }

    // Week sequence validation
    const weekNumbers = data.weeks.map(w => w.weekNumber).sort((a, b) => a - b);
    for (let i = 1; i < weekNumbers.length; i++) {
      if (weekNumbers[i] !== weekNumbers[i-1] + 1) {
        this.warnings.push(`Gap detected between week ${weekNumbers[i-1]} and ${weekNumbers[i]}`);
      }
    }

    if (this.errors.length > 0) {
      throw new Error(this.errors.join('; '));
    }
  }

  private generatePreviewData(calendar: AcademicCalendarData) {
    this.previewData = [
      {
        category: 'Academic Year',
        items: [
          { label: 'Year', value: calendar.academicYear },
          { label: 'University Opens', value: calendar.universityOpenDate.toDateString() },
          { label: 'University Closes', value: calendar.universityCloseDate.toDateString() },
          { label: 'Total Weeks', value: calendar.weeks.length }
        ]
      },
      {
        category: 'Weeks Summary',
        items: [
          { label: 'Academic Weeks', value: calendar.weeks.filter(w => w.type === 'academic').length },
          { label: 'Exam Weeks', value: calendar.weeks.filter(w => w.type === 'exam').length },
          { label: 'Break Weeks', value: calendar.weeks.filter(w => w.type === 'break').length },
          { label: 'Holiday Weeks', value: calendar.weeks.filter(w => w.type === 'holiday').length }
        ]
      },
      {
        category: 'Events',
        items: [
          { label: 'Total Events', value: calendar.specialEvents.length },
          { label: 'Academic Events', value: calendar.specialEvents.filter(e => e.type === 'academic').length },
          { label: 'Exam Events', value: calendar.specialEvents.filter(e => e.type === 'exam').length },
          { label: 'Graduation Ceremonies', value: calendar.graduationCeremonies.length }
        ]
      }
    ];
  }

  proceedToConfiguration() {
    this.uploadStep = 'configure';
  }

  async applyCalendar() {
    if (!this.parsedCalendar || this.isDestroyed || this.isModalDismissing) {
      this.showError('No calendar data to apply');
      return;
    }

    this.isModalDismissing = true;

    try {
      // Emit the parsed calendar data first
      if (!this.isDestroyed) {
        this.calendarUploaded.emit(this.parsedCalendar);
      }
      
      // Show success message
      await this.showSuccess('Academic calendar has been successfully applied!');
      
      // Small delay to ensure success message is shown
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Safely close modal with calendar data
      const modalData = {
        calendarData: this.parsedCalendar
      };
      
      // Clean up before dismissing
      this.cleanup();
      
      // Dismiss modal
      await this.modalController.dismiss(modalData);
      
    } catch (error: any) {
      console.error('Error applying calendar:', error);
      this.isModalDismissing = false;
      if (!this.isDestroyed) {
        this.showError('Failed to apply calendar: ' + error.message);
      }
    }
  }

  backToPreview() {
    this.uploadStep = 'preview';
  }

  backToUpload() {
    if (this.isDestroyed) return;
    
    this.uploadStep = 'upload';
    this.selectedFile = null;
    this.parsedCalendar = null;
    this.previewData = [];
    this.errors = [];
    this.warnings = [];
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  async cancel() {
    if (this.isDestroyed || this.isModalDismissing) {
      return;
    }

    // If no data has been uploaded, close directly
    if (!this.parsedCalendar && !this.selectedFile) {
      await this.safeModalDismiss();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancel Upload',
      message: 'Are you sure you want to cancel? All progress will be lost.',
      buttons: [
        { text: 'Continue Uploading', role: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          handler: async () => {
            await this.safeModalDismiss();
          }
        }
      ]
    });
    await alert.present();
  }

  async dismissModal() {
    await this.safeModalDismiss();
  }

  private async safeModalDismiss() {
    if (this.isDestroyed || this.isModalDismissing) {
      return;
    }

    this.isModalDismissing = true;

    try {
      // Clean up before dismissing
      this.cleanup();
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Dismiss modal
      await this.modalController.dismiss();
      
    } catch (error: any) {
      console.error('Error dismissing modal:', error);
      // Force dismiss if normal dismiss fails
      try {
        await this.modalController.dismiss();
      } catch (forceError) {
        console.error('Force dismiss also failed:', forceError);
      }
    }
  }

  downloadSampleFile(format: string) {
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'txt':
        content = this.generateSampleTxtFile();
        filename = 'academic_calendar_sample.txt';
        mimeType = 'text/plain';
        break;
      case 'csv':
        content = this.generateSampleCsvFile();
        filename = 'academic_calendar_sample.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = this.generateSampleJsonFile();
        filename = 'academic_calendar_sample.json';
        mimeType = 'application/json';
        break;
    }

    this.downloadFile(content, filename, mimeType);
  }

  private generateSampleTxtFile(): string {
    return `MUT ACADEMIC CALENDAR 2025

JANUARY
[Week 1]
Wednesday 01: Public Holiday - New Year's Day

[Week 2] 
Monday 06: University re-opens
Tuesday 07: Academic staff preparation day
Wednesday 08: Student orientation begins
Thursday 09: Late registration opens
Friday 10: Faculty meetings

[Week 3]
Monday 13: Academic staff returns
Tuesday 14: Student orientation continues
Wednesday 15: Lectures commence
Thursday 16: Add/drop period begins
Friday 17: System testing day

FEBRUARY
[Week 4]
Monday 20: Regular academic week
Wednesday 22: Department meetings
Friday 24: Student activities day

[Week 5]
Monday 27: Regular academic week
Wednesday 29: Mid-term assessments begin

MARCH
[Week 6]
Monday 06: Regular academic week
Friday 10: Mid-term assessments end

[Week 7]
Monday 13: Regular academic week
Wednesday 15: Academic progress reviews

[Week 8]
Monday 20: Regular academic week
Friday 24: Last day to withdraw

[Week 9]
Monday 27: Regular academic week

APRIL
[Week 10]
Monday 03: Regular academic week

[Week 11]
Monday 10: Regular academic week
Wednesday 12: Pre-exam consultations

[Week 12]
Monday 17: Regular academic week
Friday 21: Public Holiday - Human Rights Day

[Week 13]
Monday 24: Regular academic week
Friday 28: Lectures end - Semester 1

MAY
[Week 14]
Monday 01: Public Holiday - Workers' Day
Tuesday 02: Study break begins
Friday 05: Study break ends

[Week 15]
Monday 08: First semester examinations begin
Wednesday 10: Committee meetings
Friday 12: Examination period continues

[Week 16]
Monday 15: First semester examinations continue
Friday 19: First semester examinations end

[Week 17]
Monday 22: Examination marking period
Friday 26: Results processing

[Week 18]
Monday 29: Mid-year break begins

JUNE
[Week 19]
Monday 05: Mid-year break continues
Friday 09: Public Holiday - Youth Day

[Week 20]
Monday 12: Mid-year break continues
Friday 16: Public Holiday - Youth Day observed

[Week 21]
Monday 19: Mid-year break continues
Friday 23: Semester break ends

JULY
[Week 22]
Monday 26: Second semester preparation
Wednesday 28: Academic staff returns
Friday 30: Venue preparations

[Week 23]
Monday 02: Second semester begins
Tuesday 03: Student registration
Wednesday 04: Lectures commence - Semester 2
Thursday 05: System updates
Friday 06: Orientation for new students

[Week 24]
Monday 09: Regular academic week - Semester 2
Wednesday 11: Department meetings
Friday 13: Academic activities resume

AUGUST
[Week 25]
Monday 16: Regular academic week
Friday 20: Mid-semester break begins

[Week 26]
Monday 23: Mid-semester break
Friday 27: Mid-semester break ends

[Week 27]
Monday 30: Regular academic week

SEPTEMBER
[Week 28]
Monday 06: Regular academic week
Friday 10: Assessment period

[Week 29]
Monday 13: Regular academic week
Wednesday 15: Academic reviews

[Week 30]
Monday 20: Regular academic week
Friday 24: Public Holiday - Heritage Day

[Week 31]
Monday 27: Regular academic week

OCTOBER
[Week 32]
Monday 04: Regular academic week
Friday 08: Mid-term assessments

[Week 33]
Monday 11: Regular academic week
Friday 15: Last day for course changes

[Week 34]
Monday 18: Regular academic week
Wednesday 20: Pre-exam preparations

[Week 35]
Monday 25: Regular academic week
Friday 29: Lectures end - Semester 2

NOVEMBER
[Week 36]
Monday 01: Study break begins
Friday 05: Study break ends

[Week 37]
Monday 08: Second semester examinations begin
Wednesday 10: Examination monitoring
Friday 12: Examinations continue

[Week 38]
Monday 15: Second semester examinations continue
Friday 19: Second semester examinations end

[Week 39]
Monday 22: Annual programme examinations begin
Wednesday 24: Committee meetings scheduled
Friday 26: Annual examinations continue

[Week 40]
Monday 29: Annual programme examinations continue

DECEMBER
[Week 41]
Monday 06: Annual programme examinations end
Tuesday 07: Marking period begins
Wednesday 08: Results processing
Thursday 09: Academic reviews
Friday 10: Grade submissions due

[Week 42]
Monday 13: Results finalization
Tuesday 14: Graduation preparation begins
Wednesday 15: Faculty meetings
Thursday 16: Public Holiday - Day of Reconciliation
Friday 17: University closes for summer recess

[Week 43]
Monday 20: Summer recess begins
Wednesday 22: Administrative work continues
Friday 24: Skeleton staff only

[Week 44]
Monday 27: Summer recess continues
Tuesday 28: Maintenance period
Wednesday 29: System upgrades
Thursday 30: Year-end processing
Friday 31: New Year's Eve preparation

SPECIAL EVENTS AND CEREMONIES:
- Graduation Ceremony: Faculty of Engineering (Morning Session)
- Graduation Ceremony: Faculty of Sciences (Afternoon Session)
- Graduation Ceremony: Faculty of Humanities (Morning Session)
- Academic Committee Meetings: Monthly (Third Wednesday)
- Senate Meetings: Quarterly
- Examination Committee Meetings: Bi-annually

IMPORTANT NOTES:
- Week numbers follow the ISO 8601 standard
- Academic year runs from January to December
- Examination periods are clearly marked
- Public holidays are observed as per South African calendar
- Summer recess runs from mid-December to early January`;
  }

  private generateSampleCsvFile(): string {
    return `Date,Week,Event,Type,Description
2025-01-01,1,Public Holiday - New Year's Day,holiday,National public holiday
2025-01-06,2,University re-opens,academic,Start of academic year
2025-01-07,2,Academic staff preparation day,academic,Staff preparation and planning
2025-01-08,2,Student orientation begins,academic,New student orientation program
2025-01-09,2,Late registration opens,registration,Registration period for late students
2025-01-10,2,Faculty meetings,committee,Departmental faculty meetings
2025-01-13,3,Academic staff returns,academic,Full academic staff return from break
2025-01-14,3,Student orientation continues,academic,Continued orientation activities
2025-01-15,3,Lectures commence,academic,First day of lectures
2025-01-16,3,Add/drop period begins,registration,Course add/drop period starts
2025-01-17,3,System testing day,academic,IT systems and platform testing
2025-01-20,4,Regular academic week,academic,Normal teaching and learning activities
2025-01-22,4,Department meetings,committee,Regular departmental meetings
2025-01-24,4,Student activities day,academic,Student engagement activities
2025-01-27,5,Regular academic week,academic,Normal teaching and learning activities
2025-01-29,5,Mid-term assessments begin,exam,First mid-term assessment period
2025-03-21,12,Public Holiday - Human Rights Day,holiday,National public holiday
2025-04-28,13,Lectures end - Semester 1,academic,End of first semester lectures
2025-05-01,14,Public Holiday - Workers' Day,holiday,National public holiday
2025-05-02,14,Study break begins,break,Semester 1 study break period
2025-05-05,14,Study break ends,break,End of study break
2025-05-08,15,First semester examinations begin,exam,Start of semester 1 examinations
2025-05-19,16,First semester examinations end,exam,End of semester 1 examinations
2025-05-22,17,Examination marking period,exam,Marking and grading period
2025-05-29,18,Mid-year break begins,break,Mid-year vacation period starts
2025-06-09,19,Public Holiday - Youth Day,holiday,National public holiday
2025-06-16,20,Public Holiday - Youth Day observed,holiday,Youth Day observed
2025-06-23,21,Semester break ends,break,End of mid-year break
2025-07-02,23,Second semester begins,academic,Start of second semester
2025-07-03,23,Student registration,registration,Second semester registration
2025-07-04,23,Lectures commence - Semester 2,academic,Second semester lectures begin
2025-08-09,25,Public Holiday - National Women's Day,holiday,National public holiday
2025-08-16,25,Mid-semester break begins,break,Short semester break
2025-08-27,26,Mid-semester break ends,break,End of mid-semester break
2025-09-24,30,Public Holiday - Heritage Day,holiday,National public holiday
2025-10-29,35,Lectures end - Semester 2,academic,End of second semester lectures
2025-11-01,36,Study break begins,break,Second semester study break
2025-11-05,36,Study break ends,break,End of study break
2025-11-08,37,Second semester examinations begin,exam,Start of semester 2 examinations
2025-11-19,38,Second semester examinations end,exam,End of semester 2 examinations
2025-11-22,39,Annual programme examinations begin,exam,Start of annual examinations
2025-12-06,41,Annual programme examinations end,exam,End of annual examinations
2025-12-16,42,Public Holiday - Day of Reconciliation,holiday,National public holiday
2025-12-17,42,University closes for summer recess,break,University closure for summer
2025-12-20,43,Summer recess begins,break,Summer vacation period
2025-12-25,44,Public Holiday - Christmas Day,holiday,National public holiday
2025-12-26,44,Public Holiday - Day of Goodwill,holiday,National public holiday`;
  }

  private generateSampleJsonFile(): string {
    return JSON.stringify({
      academicYear: 2025,
      universityOpenDate: "2025-01-06",
      universityCloseDate: "2025-12-17",
      semesters: [
        {
          id: "semester1_2025",
          name: "First Semester 2025",
          startDate: "2025-01-15",
          endDate: "2025-04-28",
          terms: [
            {
              id: "term1_2025",
              name: "Term 1",
              startDate: "2025-01-15",
              endDate: "2025-02-28",
              semesterNumber: 1
            },
            {
              id: "term2_2025",
              name: "Term 2",
              startDate: "2025-03-01",
              endDate: "2025-04-28",
              semesterNumber: 1
            }
          ]
        },
        {
          id: "semester2_2025",
          name: "Second Semester 2025",
          startDate: "2025-07-04",
          endDate: "2025-10-29",
          terms: [
            {
              id: "term3_2025",
              name: "Term 3",
              startDate: "2025-07-04",
              endDate: "2025-08-15",
              semesterNumber: 2
            },
            {
              id: "term4_2025",
              name: "Term 4",
              startDate: "2025-08-30",
              endDate: "2025-10-29",
              semesterNumber: 2
            }
          ]
        }
      ],
      weeks: [
        {
          weekNumber: 1,
          startDate: "2024-12-30",
          endDate: "2025-01-05",
          type: "holiday",
          label: "Week 1 (New Year Holiday)",
          description: "New Year holiday period",
          events: [
            {
              date: "2025-01-01",
              title: "Public Holiday - New Year's Day",
              type: "holiday",
              description: "National public holiday"
            }
          ]
        },
        {
          weekNumber: 2,
          startDate: "2025-01-06",
          endDate: "2025-01-12",
          type: "pre-academic",
          label: "Week 2 (University Re-opens)",
          description: "University re-opening and preparation week",
          events: [
            {
              date: "2025-01-06",
              title: "University re-opens",
              type: "academic",
              description: "Start of academic year"
            },
            {
              date: "2025-01-07",
              title: "Academic staff preparation day",
              type: "academic",
              description: "Staff preparation and planning"
            },
            {
              date: "2025-01-08",
              title: "Student orientation begins",
              type: "registration",
              description: "New student orientation program"
            }
          ]
        },
        {
          weekNumber: 3,
          startDate: "2025-01-13",
          endDate: "2025-01-19",
          type: "academic",
          label: "Week 3 (Lectures Commence)",
          description: "First week of academic lectures",
          events: [
            {
              date: "2025-01-15",
              title: "Lectures commence",
              type: "academic",
              description: "First day of lectures"
            },
            {
              date: "2025-01-16",
              title: "Add/drop period begins",
              type: "registration",
              description: "Course add/drop period starts"
            }
          ]
        },
        {
          weekNumber: 15,
          startDate: "2025-05-05",
          endDate: "2025-05-11",
          type: "exam",
          label: "Week 15 (First Semester Exams Begin)",
          description: "First semester examination period",
          events: [
            {
              date: "2025-05-08",
              title: "First semester examinations begin",
              type: "exam",
              description: "Start of semester 1 examinations"
            }
          ]
        },
        {
          weekNumber: 18,
          startDate: "2025-05-26",
          endDate: "2025-06-01",
          type: "break",
          label: "Week 18 (Mid-year Break)",
          description: "Mid-year vacation period",
          events: [
            {
              date: "2025-05-29",
              title: "Mid-year break begins",
              type: "academic",
              description: "Mid-year vacation period starts"
            }
          ]
        }
      ],
      examPeriods: [
        {
          id: "semester1_exams_2025",
          name: "First Semester Examinations",
          type: "semester1",
          startDate: "2025-05-08",
          endDate: "2025-05-19",
          weeks: [15, 16]
        },
        {
          id: "semester2_exams_2025",
          name: "Second Semester Examinations",
          type: "semester2",
          startDate: "2025-11-08",
          endDate: "2025-11-19",
          weeks: [37, 38]
        },
        {
          id: "annual_exams_2025",
          name: "Annual Programme Examinations",
          type: "annual",
          startDate: "2025-11-22",
          endDate: "2025-12-06",
          weeks: [39, 40, 41]
        }
      ],
      breaks: [
        {
          id: "study_break_s1",
          name: "Study Break - Semester 1",
          startDate: "2025-05-02",
          endDate: "2025-05-05",
          weeks: [14]
        },
        {
          id: "mid_year_break",
          name: "Mid-Year Break",
          startDate: "2025-05-29",
          endDate: "2025-06-23",
          weeks: [18, 19, 20, 21]
        },
        {
          id: "summer_recess",
          name: "Summer Recess",
          startDate: "2025-12-17",
          endDate: "2026-01-05",
          weeks: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 1]
        }
      ],
      specialEvents: [
        {
          id: "new_year_2025",
          name: "Public Holiday - New Year's Day",
          date: "2025-01-01",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "university_opens_2025",
          name: "University re-opens",
          date: "2025-01-06",
          type: "academic",
          description: "Start of academic year"
        },
        {
          id: "human_rights_day_2025",
          name: "Public Holiday - Human Rights Day",
          date: "2025-03-21",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "workers_day_2025",
          name: "Public Holiday - Workers' Day",
          date: "2025-05-01",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "youth_day_2025",
          name: "Public Holiday - Youth Day",
          date: "2025-06-16",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "womens_day_2025",
          name: "Public Holiday - National Women's Day",
          date: "2025-08-09",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "heritage_day_2025",
          name: "Public Holiday - Heritage Day",
          date: "2025-09-24",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "reconciliation_day_2025",
          name: "Public Holiday - Day of Reconciliation",
          date: "2025-12-16",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "christmas_day_2025",
          name: "Public Holiday - Christmas Day",
          date: "2025-12-25",
          type: "holiday",
          description: "National public holiday"
        },
        {
          id: "goodwill_day_2025",
          name: "Public Holiday - Day of Goodwill",
          date: "2025-12-26",
          type: "holiday",
          description: "National public holiday"
        }
      ],
      graduationCeremonies: [
        {
          faculty: "Faculty of Engineering",
          session: "Morning Session",
          date: "2025-04-15",
          time: "09:00"
        },
        {
          faculty: "Faculty of Sciences",
          session: "Afternoon Session",
          date: "2025-04-15",
          time: "14:00"
        },
        {
          faculty: "Faculty of Humanities",
          session: "Morning Session",
          date: "2025-04-16",
          time: "09:00"
        },
        {
          faculty: "Faculty of Business and Economics",
          session: "Afternoon Session",
          date: "2025-04-16",
          time: "14:00"
        }
      ]
    }, null, 2);
  }

  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private async showSuccess(message: string) {
    if (this.isDestroyed) return;
    
    try {
      const toast = await this.toastController.create({
        message,
        duration: 3000,
        position: 'top',
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error showing success toast:', error);
    }
  }

  private async showError(message: string) {
    if (this.isDestroyed) return;
    
    try {
      const toast = await this.toastController.create({
        message,
        duration: 5000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    } catch (error) {
      console.error('Error showing error toast:', error);
    }
  }

  getWeekTypeColor(type: string): string {
    switch (type) {
      case 'academic': return 'primary';
      case 'exam': return 'danger';
      case 'break': return 'warning';
      case 'holiday': return 'secondary';
      case 'pre-academic':
      case 'post-academic':
      default: return 'medium';
    }
  }

  // Getter methods for template bindings
  get academicWeeksCount(): number {
    return this.parsedCalendar?.weeks.filter(w => w.type === 'academic').length || 0;
  }

  // CSV parsing helper methods
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  }

  private isValidDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    
    // Check format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    // Check if date is valid
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && 
           date.toISOString().substr(0, 10) === dateString;
  }

  private getWeekStartDate(referenceDate: string, weekNumber: number): string {
    const date = new Date(referenceDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    // Adjust to Monday of the same week
    date.setDate(date.getDate() + mondayOffset);
    
    return date.toISOString().substr(0, 10);
  }

  private getWeekEndDate(startDate: string): string {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 6); // Add 6 days to get Sunday
    return date.toISOString().substr(0, 10);
  }

  private determineExamType(eventName: string): 'semester1' | 'semester2' | 'annual' | 'supplementary' {
    const name = eventName.toLowerCase();
    if (name.includes('first') || name.includes('semester 1') || name.includes('mid')) return 'semester1';
    if (name.includes('second') || name.includes('semester 2')) return 'semester2';
    if (name.includes('annual') || name.includes('year')) return 'annual';
    if (name.includes('supplementary') || name.includes('supp')) return 'supplementary';
    return 'semester1'; // Default
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  get examWeeksCount(): number {
    return this.parsedCalendar?.weeks.filter(w => w.type === 'exam').length || 0;
  }

  get breakWeeksCount(): number {
    return this.parsedCalendar?.weeks.filter(w => w.type === 'break').length || 0;
  }

  get holidayWeeksCount(): number {
    return this.parsedCalendar?.weeks.filter(w => w.type === 'holiday').length || 0;
  }
}
