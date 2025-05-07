import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ReportsComponent implements OnInit {
  reportTypes = [
    { id: 'utilization', name: 'Venue Utilization Report' },
    { id: 'schedule', name: 'Lecturer Schedule Report' },
    { id: 'conflicts', name: 'Timetable Conflicts Report' },
    { id: 'availability', name: 'Lecturer Availability Report' }
  ];
  
  selectedReportType: string = 'utilization';
  startDate: string = '';
  endDate: string = '';
  reportData: any[] = [];
  isLoading: boolean = false;

  constructor() { }

  ngOnInit() {
    // Set default date range to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.startDate = this.formatDate(firstDay);
    this.endDate = this.formatDate(lastDay);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  generateReport() {
    this.isLoading = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
      switch (this.selectedReportType) {
        case 'utilization':
          this.reportData = this.getMockVenueUtilizationData();
          break;
        case 'schedule':
          this.reportData = this.getMockLecturerScheduleData();
          break;
        case 'conflicts':
          this.reportData = this.getMockConflictsData();
          break;
        case 'availability':
          this.reportData = this.getMockAvailabilityData();
          break;
      }
      this.isLoading = false;
    }, 1000);
  }

  getMockVenueUtilizationData() {
    return [
      { venue: 'Lecture Hall A', totalHours: 42, utilizationRate: '78%' },
      { venue: 'Lecture Hall B', totalHours: 38, utilizationRate: '70%' },
      { venue: 'Computer Lab 101', totalHours: 52, utilizationRate: '96%' },
      { venue: 'Seminar Room 1', totalHours: 28, utilizationRate: '52%' },
      { venue: 'Seminar Room 2', totalHours: 35, utilizationRate: '65%' }
    ];
  }

  getMockLecturerScheduleData() {
    return [
      { lecturer: 'Dr. Smith', coursesAssigned: 4, weeklyHours: 16, peakDay: 'Monday' },
      { lecturer: 'Prof. Johnson', coursesAssigned: 3, weeklyHours: 12, peakDay: 'Wednesday' },
      { lecturer: 'Dr. Williams', coursesAssigned: 5, weeklyHours: 20, peakDay: 'Tuesday' },
      { lecturer: 'Prof. Davis', coursesAssigned: 2, weeklyHours: 8, peakDay: 'Thursday' }
    ];
  }

  getMockConflictsData() {
    return [
      { type: 'Room Double Booking', count: 3, affectedCourses: 'CS101, MATH202, ENG303' },
      { type: 'Lecturer Time Conflict', count: 2, affectedCourses: 'BIO101, PHYS404' },
      { type: 'Student Group Overlap', count: 5, affectedCourses: 'HIST101, CS303, MATH101' }
    ];
  }

  getMockAvailabilityData() {
    return [
      { lecturer: 'Dr. Smith', availableSlots: 12, preferredDays: 'Mon, Wed, Fri' },
      { lecturer: 'Prof. Johnson', availableSlots: 8, preferredDays: 'Tue, Thu' },
      { lecturer: 'Dr. Williams', availableSlots: 15, preferredDays: 'Mon, Tue, Wed' },
      { lecturer: 'Prof. Davis', availableSlots: 10, preferredDays: 'Wed, Thu, Fri' }
    ];
  }

  exportReport() {
    // In a real implementation, this would generate a CSV or PDF file
    alert('Report exported successfully!');
  }
}