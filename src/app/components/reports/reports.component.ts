import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  constructor() {}

  ngOnInit() {
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

  exportReport() {
    const doc = new jsPDF();
    const reportName = this.reportTypes.find(r => r.id === this.selectedReportType)?.name || 'Report';
    const dateRange = `From ${this.startDate} to ${this.endDate}`;
    let head: string[] = [];
    let body: any[][] = [];

    switch (this.selectedReportType) {
      case 'utilization':
        head = ['Venue', 'Total Hours Used', 'Utilization Rate'];
        body = this.reportData.map(item => [item.venue, item.totalHours, item.utilizationRate]);
        break;
      case 'schedule':
        head = ['Lecturer', 'Courses Assigned', 'Weekly Hours', 'Peak Day'];
        body = this.reportData.map(item => [item.lecturer, item.coursesAssigned, item.weeklyHours, item.peakDay]);
        break;
      case 'conflicts':
        head = ['Conflict Type', 'Count', 'Affected Courses'];
        body = this.reportData.map(item => [item.type, item.count, item.affectedCourses]);
        break;
      case 'availability':
        head = ['Lecturer', 'Available Slots', 'Preferred Days'];
        body = this.reportData.map(item => [item.lecturer, item.availableSlots, item.preferredDays]);
        break;
    }

    doc.setFontSize(14);
    doc.text(reportName, 14, 20);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 27);

    autoTable(doc, {
      startY: 32,
      head: [head],
      body: body
    });

    doc.save(`${reportName}.pdf`);
  }

  // Mock Data Generators
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
}
