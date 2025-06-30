import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService, AuthState } from '../services/Authentication Services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
  standalone: false
})
export class ChangePasswordPage implements OnInit, OnDestroy {
  
  changePasswordForm!: FormGroup;
  showPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  formError: string = '';
  currentUser: AuthState | null = null;
  
  private authStateSubscription?: Subscription;
  private isLoading: boolean = false;
  private loadingElement: HTMLIonLoadingElement | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private router: Router
  ) { }

  ngOnInit() {
    // Initialize form
    this.changePasswordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordsMatchValidator
    });

    // Create a loading indicator while we wait for auth state
    this.presentInitialLoading();
    
    // Wait for Firebase to initialize properly
    setTimeout(() => {
      // First refresh the current user to ensure we have the latest data
      this.authService.refreshCurrentUser().subscribe(refreshed => {
        console.log('User refreshed:', refreshed);
        
        // Get current user after refreshing
        this.authStateSubscription = this.authService.currentAuthState$.subscribe(state => {
          console.log('Auth state in change-password:', state);
          this.currentUser = state;
          
          if (this.isLoading) {
            this.dismissInitialLoading();
          }
          
          // If not logged in, redirect to login page
          if (!state.isLoggedIn || !state.uid) {
            // Don't redirect immediately, wait to see if auth state updates
            setTimeout(() => {
              const currentState = this.currentUser;
              if (!currentState?.isLoggedIn || !currentState?.uid) {
                console.log('No authenticated user after waiting, redirecting to login');
                this.showNoSessionError();
              }
            }, 2000); // Wait 2 seconds before redirecting
          }
        });
      });
    }, 1000); // Wait 1 second before refreshing
  }
  
  ngOnDestroy() {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
  }

  // Form getters
  get currentPasswordControl() {
    return this.changePasswordForm.get('currentPassword');
  }

  get newPasswordControl() {
    return this.changePasswordForm.get('newPassword');
  }

  get confirmPasswordControl() {
    return this.changePasswordForm.get('confirmPassword');
  }

  // Validate that password and confirm password match
  passwordsMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (newPassword !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  // Toggle password visibility
  togglePasswordVisibility(field: string) {
    switch(field) {
      case 'currentPassword':
        this.showPassword = !this.showPassword;
        break;
      case 'newPassword':
        this.showNewPassword = !this.showNewPassword;
        break;
      case 'confirmPassword':
        this.showConfirmPassword = !this.showConfirmPassword;
        break;
    }
  }

  async presentInitialLoading() {
    this.isLoading = true;
    try {
      this.loadingElement = await this.loadingController.create({
        message: 'Loading user information...',
        spinner: 'circular',
      });
      
      await this.loadingElement.present();
      
      // Set a timeout in case user data never loads
      setTimeout(async () => {
        if (this.isLoading) {
          await this.dismissInitialLoading();
          if (!this.currentUser?.uid) {
            this.showNoSessionError();
          }
        }
      }, 5000); // 5 second timeout
    } catch (e) {
      console.error('Error creating loading controller:', e);
      this.isLoading = false;
    }
  }
  
  async dismissInitialLoading() {
    this.isLoading = false;
    try {
      if (this.loadingElement) {
        await this.loadingElement.dismiss();
        this.loadingElement = null;
      }
    } catch (e) {
      console.error('Error dismissing loading controller:', e);
    }
  }
  
  async showNoSessionError() {
    const alert = await this.alertController.create({
      header: 'Session Error',
      message: 'Your session could not be verified. Please login again.',
      buttons: [
        {
          text: 'OK',
          handler: () => {
            this.router.navigate(['/home']);
          }
        }
      ],
      backdropDismiss: false
    });
    
    await alert.present();
  }

  async changePassword() {
    // Clear previous errors
    this.formError = '';
    
    // Double check that we have a user session
    if (!this.currentUser?.uid || !this.currentUser?.email) {
      this.formError = 'User session information is missing. Please login again.';
      setTimeout(() => {
        this.router.navigate(['/home']);
      }, 2000);
      return;
    }

    if (!this.changePasswordForm.valid) {
      this.changePasswordForm.markAllAsTouched();
      
      if (this.changePasswordForm.hasError('passwordMismatch')) {
        this.formError = 'Passwords do not match';
      } else if (this.newPasswordControl?.errors?.['minlength']) {
        this.formError = 'New password must be at least 8 characters';
      }
      
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Changing password...',
      spinner: 'circular',
    });
    
    await loading.present();

    const currentPassword = this.changePasswordForm.value.currentPassword;
    const newPassword = this.changePasswordForm.value.newPassword;
    
    // For first-time users, proceed directly without reauthentication
    if (this.currentUser.isFirstLogin) {
      // Skip reauthentication for first login as we're using default password
      this.authService.changePassword(newPassword).subscribe({
        next: async (changeResult) => {
          await loading.dismiss();
          
          if (changeResult.success) {
            // Mark first login as false
            if (this.currentUser?.uid) {
              this.authService.updateFirstLoginStatus(this.currentUser.uid, false).subscribe();
            }
            
            // Show success message and redirect
            const alert = await this.alertController.create({
              header: 'Success',
              message: 'Your password has been changed successfully',
              buttons: [
                {
                  text: 'OK',
                  handler: () => {
                    // Redirect to appropriate dashboard
                    if (this.currentUser?.role) {
                      this.authService.navigateByRole(this.currentUser.role, false);
                    } else {
                      this.router.navigate(['/home']);
                    }
                  }
                }
              ]
            });
            
            await alert.present();
          } else {
            this.formError = changeResult.message;
          }
        },
        error: async (error) => {
          console.error('Error changing password:', error);
          await loading.dismiss();
          if (error.code === 'auth/requires-recent-login') {
            this.showSessionExpiredError();
          } else {
            this.formError = 'Failed to change password. Please try again.';
          }
        }
      });
      return;
    }

    // For regular password changes, try reauthentication first
    try {
      // First ensure we have the latest user information
      this.authService.refreshCurrentUser().subscribe({
        next: (refreshed) => {
          console.log('User refreshed before password change:', refreshed);
          
          // Now attempt to reauthenticate
          const email = this.currentUser?.email;
          if (!email) {
            loading.dismiss();
            this.formError = 'User email information is missing';
            return;
          }
          
          // Reauthenticate first (required for password change)
          this.authService.reauthenticate(email, currentPassword).subscribe({
            next: (reAuthResult) => {
              if (reAuthResult.success) {
                // Now change the password
                this.authService.changePassword(newPassword).subscribe({
                  next: async (changeResult) => {
                    await loading.dismiss();
                    
                    if (changeResult.success) {
                      // Mark first login as false if it was a first login
                      if (this.currentUser?.uid && this.currentUser.isFirstLogin) {
                        this.authService.updateFirstLoginStatus(this.currentUser.uid, false).subscribe();
                      }
                      
                      // Show success message and redirect
                      const alert = await this.alertController.create({
                        header: 'Success',
                        message: 'Your password has been changed successfully',
                        buttons: [
                          {
                            text: 'OK',
                            handler: () => {
                              // Redirect to appropriate dashboard
                              if (this.currentUser?.role) {
                                this.authService.navigateByRole(this.currentUser.role, false);
                              } else {
                                this.router.navigate(['/home']);
                              }
                            }
                          }
                        ]
                      });
                      
                      await alert.present();
                    } else {
                      this.formError = changeResult.message;
                    }
                  },
                  error: async (error) => {
                    console.error('Error changing password:', error);
                    await loading.dismiss();
                    this.formError = 'Failed to change password. Please try again.';
                  }
                });
              } else {
                loading.dismiss();
                this.formError = reAuthResult.message;
                
                // If the credentials are invalid, suggest signing out and back in
                if (reAuthResult.message.includes('Invalid credentials') || 
                    reAuthResult.message.includes('session has expired')) {
                  setTimeout(() => {
                    this.showSessionExpiredError();
                  }, 1000);
                }
              }
            },
            error: async (error) => {
              console.error('Reauthentication error:', error);
              await loading.dismiss();
              this.formError = 'Failed to authenticate. Please try again.';
            }
          });
        },
        error: async (error) => {
          console.error('Error refreshing user:', error);
          await loading.dismiss();
          this.formError = 'Failed to refresh user session. Please try logging out and back in.';
        }
      });
    } catch (error) {
      console.error('Unexpected error in change password flow:', error);
      await loading.dismiss();
      this.formError = 'An unexpected error occurred. Please try again later.';
    }
  }

  // Add a method to show session expired error
  async showSessionExpiredError() {
    const alert = await this.alertController.create({
      header: 'Session Issue',
      message: 'Your session appears to have expired or authentication is stale. Would you like to sign out and sign back in?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Sign Out',
          handler: () => {
            this.authService.logout().subscribe({
              next: () => {
                this.router.navigate(['/home']);
              }
            });
          }
        }
      ]
    });
    
    await alert.present();
  }

  // Cancel password change and logout
  cancel() {
    // Show confirmation dialog
    this.alertController.create({
      header: 'Cancel Password Change',
      message: 'Are you sure you want to cancel? You will be logged out.',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes, Log Out',
          handler: () => {
            this.authService.logout().subscribe();
          }
        }
      ]
    }).then(alert => {
      alert.present();
    });
  }
}
