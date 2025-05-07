import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  loginForm!: FormGroup;
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }
  
  // Safe getter methods for form controls
  get usernameControl() {
    return this.loginForm.get('username');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }
  
  async login() {
    if (this.loginForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Signing in...',
        spinner: 'circular',
      });
      
      await loading.present();
      
      // Simulate API call delay
      setTimeout(async () => {
        await loading.dismiss();
        
        // For demo purposes - in a real app you would authenticate with a service
        // and handle successful login or errors accordingly
        this.router.navigate(['/admin-dash']);
      }, 1500);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Forgot Password',
      message: 'Enter your username or email address to reset your password',
      inputs: [
        {
          name: 'email',
          type: 'text',
          placeholder: 'Username or Email'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reset Password',
          handler: (data) => {
            if (data.email) {
              this.sendPasswordResetEmail(data.email);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async sendPasswordResetEmail(email: string) {
    const loading = await this.loadingController.create({
      message: 'Processing request...',
      spinner: 'circular',
    });
    
    await loading.present();
    
    // Simulate API call
    setTimeout(async () => {
      await loading.dismiss();
      
      const successAlert = await this.alertController.create({
        header: 'Password Reset Email Sent',
        message: 'Check your email for instructions to reset your password.',
        buttons: ['OK']
      });
      
      await successAlert.present();
    }, 1500);
  }
}