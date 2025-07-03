import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { LecturerService } from '../../services/Entity Management Services/lecturer.service';
import { User } from '../add-user/add-user.component';

@Component({
  selector: 'app-bulk-upload-lecturers',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './bulk-upload-lecturers.component.html',
  styleUrls: ['./bulk-upload-lecturers.component.scss']
})
export class BulkUploadLecturersComponent implements OnInit {
  
  selectedFile: File | null = null;
  isProcessing = false;
  isUploading = false;
  previewData: User[] = [];
  showPreview = false;
  uploadProgress = 0;
  errors: string[] = [];

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private lecturerService: LecturerService
  ) { }

  ngOnInit() {}
  
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      if (!allowedTypes.includes(file.type)) {
        this.presentAlert('Invalid File Type', 'Please select an Excel (.xlsx, .xls) or CSV file.');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.presentAlert('File Too Large', 'Please select a file smaller than 5MB.');
        return;
      }
      
      this.selectedFile = file;
      this.showPreview = false;
      this.previewData = [];
      this.errors = [];
    }
  }
  
  processFile() {
    if (!this.selectedFile) return;
    
    this.isProcessing = true;
    this.errors = [];
    
    this.lecturerService.processSpreadsheet(this.selectedFile).subscribe({
      next: (result) => {
        this.isProcessing = false;
        
        if (result.success && result.data) {
          this.previewData = result.data;
          this.showPreview = true;
          this.presentAlert('Preview Ready', `${result.data.length} lecturers found. Please review the data before uploading.`);
        } else {
          this.presentAlert('Processing Error', result.message);
        }
      },
      error: (error) => {
        this.isProcessing = false;
        this.presentAlert('Processing Error', `Failed to process file: ${error.message}`);
      }
    });
  }
  
  uploadLecturers() {
    if (this.previewData.length === 0) return;
    
    this.isUploading = true;
    this.uploadProgress = 0;
    this.errors = [];
    
    // Simulate progress for user feedback
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 100);
    
    this.lecturerService.addLecturersBulk(this.previewData).subscribe({
      next: (result) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;
        
        if (result.success) {
          this.errors = result.errors;
          
          let message = `Successfully added ${result.addedCount} lecturers.`;
          if (result.errors.length > 0) {
            message += ` ${result.errors.length} errors occurred.`;
          }
          
          this.presentAlert('Upload Complete', message);
          
          // Close modal and return result
          this.modalController.dismiss({
            success: true,
            addedCount: result.addedCount,
            errors: result.errors
          });
        } else {
          this.errors = result.errors;
          this.presentAlert('Upload Failed', result.message);
        }
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;
        this.presentAlert('Upload Error', `Failed to upload lecturers: ${error.message}`);
      }
    });
  }
  
  downloadTemplate() {
    // Create a template CSV/Excel file for download
    const templateData = [
      ['ID', 'Title', 'Name', 'Sex', 'Email', 'Mobile', 'Room Name', 'Schedulable', 'Weekly Target', 'Total Target'],
      ['L001', 'DR', 'John Smith', 'M', 'john.smith@university.edu', '+1234567890', 'Room 101', 'TRUE', '20', '600'],
      ['L002', 'MS', 'Jane Doe', 'F', 'jane.doe@university.edu', '+1234567891', 'Room 102', 'TRUE', '18', '540'],
    ];
    
    // Convert to CSV
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lecturer_upload_template.csv';
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
  }
  
  removeLecturer(index: number) {
    this.previewData.splice(index, 1);
  }
  
  editLecturer(index: number, field: string, value: string) {
    // Simple inline editing for preview data
    if (this.previewData[index]) {
      if (field === 'email') {
        this.previewData[index].contact.email = value;
      } else {
        (this.previewData[index] as any)[field] = value;
      }
    }
  }
  
  dismissModal() {
    this.modalController.dismiss();
  }
  
  private async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
