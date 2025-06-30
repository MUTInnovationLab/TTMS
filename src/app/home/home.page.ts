import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../services/Authentication Services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  loginForm!: FormGroup;
  showPassword = false;
  loginError: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    // Check if user is already logged in after a small delay to ensure Firebase is initialized
    setTimeout(() => {
      this.authService.currentAuthState$.subscribe(state => {
        if (state.isLoggedIn && state.role) {
          // User is already logged in, navigate to appropriate dashboard
          this.authService.navigateByRole(state.role, state.isFirstLogin);
        }
      });
    }, 1000);
  }
  
  // Safe getter methods for form controls
  get usernameControl() {
    return this.loginForm.get('username');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }
  
  async login() {
    // Clear previous errors
    this.loginError = '';

    if (this.loginForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Signing in...',
        spinner: 'circular',
      });
      
      await loading.present();
      
      const email = this.loginForm.value.username;
      const password = this.loginForm.value.password;
      
      // Call auth service to handle login
      this.authService.login(email, password).subscribe({
        next: async (result) => {
          await loading.dismiss();
          
          if (result.success) {
            console.log('Login successful. Role:', result.role);
            
            if (result.role) {
              // Navigate based on role and first login status
              this.authService.navigateByRole(result.role, result.isFirstLogin || false);
            } else {
              this.loginError = 'User role not found. Please contact administrator.';
            }
          } else {
            this.loginError = result.message;
          }
        },
        error: async (error) => {
          console.error('Login error:', error);
          await loading.dismiss();
          this.loginError = 'An unexpected error occurred. Please try again.';
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
      
      if (this.usernameControl?.errors?.['email']) {
        this.loginError = 'Please enter a valid email address';
      } else if (this.usernameControl?.errors?.['required']) {
        this.loginError = 'Email is required';
      } else if (this.passwordControl?.errors?.['required']) {
        this.loginError = 'Password is required';
      }
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Forgot Password',
      message: 'Enter your email address to reset your password',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email'
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
    
    // Use AuthService's password reset method instead of accessing afAuth directly
    this.authService.sendPasswordResetEmail(email).subscribe({
      next: async (result) => {
        await loading.dismiss();
        
        if (result.success) {
          const successAlert = await this.alertController.create({
            header: 'Password Reset Email Sent',
            message: 'Check your email for instructions to reset your password.',
            buttons: ['OK']
          });
          
          await successAlert.present();
        } else {
          const errorAlert = await this.alertController.create({
            header: 'Error',
            message: result.message,
            buttons: ['OK']
          });
          
          await errorAlert.present();
        }
      },
      error: async (error) => {
        console.error('Password reset error:', error);
        await loading.dismiss();
        
        const errorAlert = await this.alertController.create({
          header: 'Error',
          message: 'An unexpected error occurred. Please try again.',
          buttons: ['OK']
        });
        
        await errorAlert.present();
      }
    });
  }
}