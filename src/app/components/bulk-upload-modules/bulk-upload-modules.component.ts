import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { ModuleService, Module } from '../../services/Entity Management Services/module.service';
import { AuthService } from '../../services/Authentication Services/auth.service';

@Component({
  selector: 'app-bulk-upload-modules',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './bulk-upload-modules.component.html',
  styleUrls: ['./bulk-upload-modules.component.scss']
})
export class BulkUploadModulesComponent implements OnInit {
  selectedFile: File | null = null;
  isProcessing = false;
  isUploading = false;
  previewData: Module[] = [];
  showPreview = false;
  uploadProgress = 0;
  errors: string[] = [];

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private moduleService: ModuleService,
    private authService: AuthService
  ) {}

  ngOnInit() {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];

      if (!allowedTypes.includes(file.type)) {
        this.presentAlert('Invalid File Type', 'Please select an Excel (.xlsx, .xls) or CSV file.');
        return;
      }

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

    this.moduleService.processSpreadsheet(this.selectedFile).subscribe({
      next: (result) => {
        this.isProcessing = false;

        if (result.success && result.data) {
          const currentUser = this.authService.getCurrentUser();
          const department = currentUser?.department || '';
          this.previewData = result.data.map(module => ({
            ...module,
            id: Date.now() + Math.floor(Math.random() * 1000), // Temporary unique ID
            department: department
          }));
          this.showPreview = true;
          this.presentAlert('Preview Ready', `${result.data.length} modules found. Please review the data before uploading.`);
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

  uploadModules() {
    if (this.previewData.length === 0) return;

    this.isUploading = true;
    this.uploadProgress = 0;
    this.errors = [];

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 100);

    this.moduleService.addModulesBulk(this.previewData).subscribe({
      next: (result) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.isUploading = false;

        if (result.success) {
          this.errors = result.errors;

          let message = `Successfully added ${result.addedCount} modules.`;
          if (result.errors.length > 0) {
            message += ` ${result.errors.length} errors occurred.`;
          }

          this.presentAlert('Upload Complete', message);

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
        this.presentAlert('Upload Error', `Failed to upload modules: ${error.message}`);
      }
    });
  }

  downloadTemplate() {
    const templateData = [
      ['Code', 'Name', 'Credits', 'Sessions per Week', 'Lecturer IDs', 'Program', 'Year', 'Elective Group'],
      ['CS101', 'Introduction to Programming', '10', '3', '1,3', 'Computer Science', '1', 'Group A'],
      ['CS205', 'Database Systems', '15', '4', '2', 'Computer Science', '2', '']
    ];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'module_upload_template.csv';
    a.click();

    window.URL.revokeObjectURL(url);
  }

  removeModule(index: number) {
    this.previewData.splice(index, 1);
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