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
      
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        this.presentAlert('Invalid File Type', 'Please select an Excel (.xlsx, .xls) or CSV file. For CSV files, ensure they use comma delimiters.');
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
      
      // Show helpful message for CSV files
      if (file.name.toLowerCase().endsWith('.csv')) {
        this.presentAlert('CSV File Selected', 'CSV file selected. Please ensure your file uses comma delimiters and matches the template format. Required columns: unique_name, name, title, Sex, Email, deptName, Room Name, Schedulable, Weekly Target, Total Target');
      }
    }
  }
  
  processFile() {
    if (!this.selectedFile) return;
    
    this.isProcessing = true;
    this.errors = [];
    
    const fileType = this.selectedFile.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'Excel';
    console.log(`Processing ${fileType} file:`, this.selectedFile.name);
    
    this.lecturerService.processSpreadsheet(this.selectedFile).subscribe({
      next: (result) => {
        this.isProcessing = false;
        
        if (result.success && result.data) {
          this.previewData = result.data;
          this.showPreview = true;
          this.presentAlert('Preview Ready', `${result.data.length} lecturers found in your ${fileType} file. Please review the data before uploading.`);
        } else {
          console.error('Processing failed:', result.message);
          let errorMessage = result.message;
          
          // Provide specific guidance for CSV files
          if (fileType === 'CSV') {
            errorMessage += '\n\nFor CSV files, please ensure:\n• Use comma delimiters\n• Include all required columns\n• Follow the exact template format\n• Download the template for reference';
          }
          
          this.presentAlert('Processing Error', errorMessage);
        }
      },
      error: (error) => {
        this.isProcessing = false;
        console.error('Processing error:', error);
        
        let errorMessage = `Failed to process ${fileType} file: ${error.message || error}`;
        
        if (fileType === 'CSV') {
          errorMessage += '\n\nPlease ensure your CSV file uses comma delimiters and matches the template format.';
        }
        
        this.presentAlert('Processing Error', errorMessage);
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
    // Create a template CSV file for download with comma delimiters
    const templateData = [
      ['unique_name', 'name', 'title', 'Sex', 'Email', 'deptName', 'Room Name', 'Schedulable', 'Weekly Target', 'Total Target'],
      ['92285', 'NKOSI SG', 'MR', 'M', 'nkosi@mut.ac.za', 'INFO & COMMS TECHNOLOGY', 'Room C19', 'TRUE', '20', '600'],
      ['90001', 'Chonco AA', 'MISS', 'F', 'chonco@mut.ac.za', 'INFO & COMMS TECHNOLOGY', 'Room C18', 'TRUE', '18', '540'],
      ['90002', 'Smith JD', 'DR', 'M', 'smith@mut.ac.za', 'INFO & COMMS TECHNOLOGY', 'Room C17', 'TRUE', '22', '660']
    ];
    
    // Convert to CSV with proper comma delimiter handling
    const csvContent = templateData.map(row => 
      row.map(cell => {
        // Handle cells that contain commas by wrapping in quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    // Add UTF-8 BOM to ensure proper encoding
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lecturer_upload_template.csv';
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    // Show helpful message
    this.presentAlert(
      'Template Downloaded', 
      'CSV template downloaded successfully. The template uses comma delimiters. Please ensure your data follows this exact format with the required columns: unique_name, name, title, Sex, Email, deptName, Room Name, Schedulable, Weekly Target, Total Target'
    );
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
