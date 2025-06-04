import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { ChartConfiguration, ChartType, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, NgChartsModule]
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

  // Fix chart data type
  chartData: ChartData<'bar'> | null = null;
  chartLabels: string[] = [];
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };
  chartType: ChartType = 'bar';

  constructor(private firestore: Firestore) {}

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
    
    // Add timeout to ensure loading state is visible
    setTimeout(() => {
      switch (this.selectedReportType) {
        case 'utilization':
          // Try to get real data from Firestore, fallback to mock data
          this.getVenueUtilizationDataFromFirestore().subscribe({
            next: (data) => {
              if (data && data.length > 0) {
                this.reportData = data.map((item: any) => ({
                  venue: item.name || item.venueName || 'Unknown Venue',
                  totalHours: item.totalHours || Math.floor(Math.random() * 40) + 10,
                  utilizationRate: item.utilizationRate || `${Math.floor(Math.random() * 30) + 60}%`
                }));
              } else {
                // Use mock data if no real data available
                this.reportData = this.getMockUtilizationData();
              }
              this.setChartData();
              this.isLoading = false;
            },
            error: (error) => {
              console.error('Error fetching venue data:', error);
              // Use mock data on error
              this.reportData = this.getMockUtilizationData();
              this.setChartData();
              this.isLoading = false;
            }
          });
          break;

        case 'schedule':
          this.reportData = this.getMockLecturerScheduleData();
          this.setChartData();
          this.isLoading = false;
          break;

        case 'conflicts':
          this.reportData = this.getMockConflictsData();
          this.setChartData();
          this.isLoading = false;
          break;

        case 'availability':
          this.reportData = this.getMockAvailabilityData();
          this.setChartData();
          this.isLoading = false;
          break;
      }
    }, 500);
  }

  setChartData() {
    switch (this.selectedReportType) {
      case 'utilization':
        this.chartType = 'bar';
        this.chartLabels = this.reportData.map(d => d.venue);
        this.chartData = {
          labels: this.chartLabels,
          datasets: [{
            label: 'Total Hours',
            data: this.reportData.map(d => d.totalHours),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        };
        break;

      case 'schedule':
        this.chartType = 'bar';
        this.chartLabels = this.reportData.map(d => d.lecturer);
        this.chartData = {
          labels: this.chartLabels,
          datasets: [{
            label: 'Weekly Hours',
            data: this.reportData.map(d => d.weeklyHours),
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }]
        };
        break;

      default:
        this.chartData = null;
        this.chartLabels = [];
        break;
    }
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

    const worksheetData = [head, ...body];
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${reportName}.xlsx`);
  }

  getVenueUtilizationDataFromFirestore(): Observable<any[]> {
    try {
      const venuesRef = collection(this.firestore, 'venues');
      return collectionData(venuesRef, { idField: 'id' });
    } catch (error) {
      console.error('Error accessing Firestore:', error);
      // Return empty observable if Firestore fails
      return new Observable(subscriber => {
        subscriber.next([]);
        subscriber.complete();
      });
    }
  }

  getMockUtilizationData() {
    return [
      { venue: 'Lecture Hall A', totalHours: 35, utilizationRate: '87%' },
      { venue: 'Computer Lab 1', totalHours: 28, utilizationRate: '70%' },
      { venue: 'Conference Room B', totalHours: 15, utilizationRate: '38%' },
      { venue: 'Auditorium', totalHours: 42, utilizationRate: '95%' },
      { venue: 'Seminar Room C', totalHours: 22, utilizationRate: '55%' }
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