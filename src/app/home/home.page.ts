import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../services/Authentication Services/auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  loginForm: FormGroup;
  showPassword = false;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private isRedirecting = false;
  private initializationComplete = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private authService: AuthService
  ) {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  async ngOnInit() {
    console.log('🏠 HomePage ngOnInit - starting initialization');
    
    // Listen for navigation events to detect when user comes back to home
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.url === '/home' || event.url === '/') {
        console.log('🏠 User navigated to home page - clearing auth state');
        this.clearAuthenticationStateOnHomeNavigation();
      }
    });
    
    try {
      // Wait for auth service to initialize
      await this.authService.waitForInitialization();
      console.log('🏠 Auth service initialized');
      
      // Clear authentication state when home page loads
      await this.clearAuthenticationStateOnHomeNavigation();
      
      // Load saved credentials for convenience
      this.loadSavedCredentials();
      
      this.initializationComplete = true;
      console.log('🏠 HomePage initialization complete - staying on login page');
      
    } catch (error) {
      console.error('❌ Error during HomePage initialization:', error);
      this.initializationComplete = true;
    }
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  // Clear authentication state when user navigates to home page
  private async clearAuthenticationStateOnHomeNavigation() {
    try {
      console.log('🔄 Clearing authentication state - user is on home page');
      
      // Force logout to clear all authentication state
      await this.authService.logout();
      
      // Reset form to ensure clean state
      this.loginForm.reset();
      this.loginForm.patchValue({
        username: '',
        password: '',
        rememberMe: false
      });
      
      // Reset component state
      this.isRedirecting = false;
      this.showPassword = false;
      
      console.log('✅ Authentication state cleared successfully');
      
    } catch (error) {
      console.error('⚠️ Error clearing auth state:', error);
    }
  }

  // Load saved credentials from localStorage
  private loadSavedCredentials() {
    try {
      const rememberMe = localStorage.getItem('rememberMe');
      const savedEmail = localStorage.getItem('savedEmail');
      
      if (rememberMe === 'true' && savedEmail) {
        this.loginForm.patchValue({
          username: savedEmail,
          rememberMe: true
        });
        console.log('🔑 Loaded saved credentials for:', savedEmail);
      }
    } catch (error) {
      console.error('⚠️ Error loading saved credentials:', error);
    }
  }

  // Getter methods for form controls
  get usernameControl() {
    return this.loginForm.get('username');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Main login method
  async login() {
    if (!this.loginForm.valid) {
      await this.showAlert('Invalid Form', 'Please fill in all required fields correctly.');
      return;
    }

    if (this.isRedirecting) {
      console.log('⚠️ Already processing login, please wait...');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Signing in...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const email = this.loginForm.value.username.trim();
      const password = this.loginForm.value.password;

      console.log('🔐 Attempting login with email:', email);

      // Use AuthService for authentication
      const result = await this.authService.login(email, password);
      console.log('🔍 Login result:', result);

      if (result.success) {
        // Handle remember me functionality
        if (this.loginForm.value.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('savedEmail', email);
        } else {
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('savedEmail');
        }

        console.log('🎯 User type from login result:', result.userType);

        // Show success message
        await this.showAlert('Success', result.message);

        // Navigate to appropriate dashboard
        await this.redirectToAppropriateDashboard(result.userType);
      } else {
        await this.showAlert('Login Failed', result.message);
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      await this.showAlert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      await loading.dismiss();
    }
  }

  // Redirect to appropriate dashboard based on user type
  private async redirectToAppropriateDashboard(userType?: string) {
    if (this.isRedirecting) {
      console.log('⚠️ Already redirecting, skipping...');
      return;
    }

    this.isRedirecting = true;

    try {
      // Use the passed userType or get from service
      const typeToUse = userType || this.authService.userType;
      
      console.log('🚀 Redirecting with user type:', typeToUse);

      if (typeToUse === 'admin') {
        console.log('➡️ Navigating to admin dashboard');
        await this.router.navigate(['/admin-dash'], { 
          replaceUrl: true,
          state: { fromLogin: true }
        });
      } else if (typeToUse === 'hod') {
        console.log('➡️ Navigating to HOD dashboard');
        await this.router.navigate(['/hod-dash'], { 
          replaceUrl: true,
          state: { fromLogin: true }
        });
      } else {
        console.log('⚠️ Unknown user type, staying on login page');
        await this.showAlert('Error', 'Unable to determine user role. Please try logging in again.');
        this.isRedirecting = false;
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      await this.showAlert('Error', 'Failed to navigate to dashboard.');
      this.isRedirecting = false;
    }
  }

  // Forgot password functionality
  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Password Recovery',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Enter your email address',
          value: this.loginForm.value.username || ''
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send Reset Email',
          handler: async (data) => {
            if (data.email && data.email.trim()) {
              await this.sendPasswordReset(data.email.trim());
            } else {
              await this.showAlert('Error', 'Please enter a valid email address.');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Send password reset email
  private async sendPasswordReset(email: string) {
    const loading = await this.loadingController.create({
      message: 'Sending reset email...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const result = await this.authService.resetPassword(email);
      await this.showAlert(
        result.success ? 'Success' : 'Error',
        result.message
      );
    } catch (error) {
      console.error('❌ Password reset error:', error);
      await this.showAlert('Error', 'Failed to send password reset email.');
    } finally {
      await loading.dismiss();
    }
  }

  // Show register option
  async showRegisterOption() {
    const alert = await this.alertController.create({
      header: 'Register New HOD',
      message: 'Contact system administrator to register new HOD accounts.',
      buttons: [
        {
          text: 'Contact Admin',
          handler: () => {
            window.open('mailto:admin@mut.ac.za?subject=New HOD Registration Request');
          }
        },
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  // Utility method to show alerts
  private async showAlert(header: string, message: string, buttons: string[] = ['OK']) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons
    });
    await alert.present();
  }

  // Reset redirecting flag when entering the page
  ionViewWillEnter() {
    console.log('🏠 ionViewWillEnter - resetting state and clearing auth');
    this.isRedirecting = false;
    
    // Clear authentication state every time we enter home page
    this.clearAuthenticationStateOnHomeNavigation();
    
    // Only load saved credentials if initialization is complete
    if (this.initializationComplete) {
      this.loadSavedCredentials();
    }
  }

  // Ensure clean state when leaving the page
  ionViewWillLeave() {
    console.log('🏠 ionViewWillLeave - cleaning up');
    this.isRedirecting = false;
  }

  // Development helper method
  async showSystemInfo() {
    const alert = await this.alertController.create({
      header: 'System Information',
      message: `
        <p><strong>Timetable Management System</strong></p>
        <p>Version: 1.0.0</p>
        <p>For technical support, contact: admin@mut.ac.za</p>
        <br>
        <p><small>Authorized users only. All access is logged and monitored.</small></p>
      `,
      buttons: ['OK']
    });
    await alert.present();
  }
}