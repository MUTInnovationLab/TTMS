import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AuthResult {
  success: boolean;
  message: string;
  userType?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  userType: 'admin' | 'hod';
  displayName?: string;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  public user$ = this.currentUserSubject.asObservable();
  private isInitialized = false;
  
  // Default admin credentials
  private readonly DEFAULT_ADMIN = {
    email: 'admin@mut.ac.za',
    password: 'Room16'
  };
  
  // Mock users database (for testing without Firebase)
  private readonly MOCK_USERS = [
    {
      email: 'admin@mut.ac.za',
      password: 'Room16',
      userType: 'admin' as const,
      uid: 'admin-uid-001',
      displayName: 'System Administrator'
    },
    {
      email: 'hod@mut.ac.za',
      password: 'password123',
      userType: 'hod' as const,
      uid: 'hod-uid-001',
      displayName: 'HOD User'
    },
    {
      email: 'test@admin.com',
      password: 'admin123',
      userType: 'admin' as const,
      uid: 'admin-uid-002',
      displayName: 'Test Admin'
    }
  ];
  
  // User type constants
  private readonly ADMIN_EMAILS = [
    'admin@mut.ac.za',
    'system.admin@mut.ac.za',
    'admin@test.com',
    'test@admin.com'
  ];

  constructor() {
    // Simulate initialization
    setTimeout(() => {
      this.isInitialized = true;
      console.log('✅ Mock Auth service initialized');
    }, 100);
  }

  /**
   * Wait for auth service to be initialized
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  /**
   * Determine user type based on email
   */
  private determineUserType(email: string): 'admin' | 'hod' {
    const lowerEmail = email.toLowerCase();
    
    if (this.ADMIN_EMAILS.map(e => e.toLowerCase()).includes(lowerEmail)) {
      return 'admin';
    }
    
    if (lowerEmail.includes('admin')) {
      return 'admin';
    }
    
    return 'hod';
  }

  /**
   * Mock login implementation
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('🔐 Mock login attempt for:', email);
      
      // Find user in mock database
      const mockUser = this.MOCK_USERS.find(
        user => user.email.toLowerCase() === email.toLowerCase() && 
                user.password === password
      );
      
      if (mockUser) {
        const userProfile: UserProfile = {
          uid: mockUser.uid,
          email: mockUser.email,
          userType: mockUser.userType,
          displayName: mockUser.displayName,
          createdAt: new Date()
        };
        
        this.currentUserSubject.next(userProfile);
        
        return {
          success: true,
          message: `Welcome back! Logged in as ${userProfile.userType.toUpperCase()} (Mock Mode).`,
          userType: userProfile.userType
        };
      } else {
        return {
          success: false,
          message: 'Invalid email or password. Try admin@mut.ac.za / Room16 or hod@mut.ac.za / password123'
        };
      }
    } catch (error: any) {
      console.error('❌ Mock login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<AuthResult> {
    try {
      this.currentUserSubject.next(null);
      return {
        success: true,
        message: 'Successfully logged out.'
      };
    } catch (error: any) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Error during logout. Please try again.'
      };
    }
  }

  /**
   * Mock password reset
   */
  async resetPassword(email: string): Promise<AuthResult> {
    return {
      success: true,
      message: 'Password reset email sent successfully (Mock Mode).'
    };
  }

  /**
   * Mock user registration
   */
  async registerUser(email: string, password: string, userType: 'admin' | 'hod' = 'hod'): Promise<AuthResult> {
    if (!this.isAdmin) {
      return {
        success: false,
        message: 'Only administrators can register new users.'
      };
    }

    return {
      success: true,
      message: `User registered successfully as ${userType.toUpperCase()} (Mock Mode).`,
      userType: userType
    };
  }

  // Getters
  get currentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user ? user.userType === 'admin' : false;
  }

  get isHOD(): boolean {
    const user = this.currentUserSubject.value;
    return user ? user.userType === 'hod' : false;
  }

  get userType(): 'admin' | 'hod' | null {
    const user = this.currentUserSubject.value;
    return user ? user.userType : null;
  }

  get userEmail(): string | null {
    const user = this.currentUserSubject.value;
    return user ? user.email : null;
  }

  get isDefaultAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user ? user.uid === 'admin-uid-001' : false;
  }

  getDefaultAdminCredentials(): { email: string; password: string } {
    return { ...this.DEFAULT_ADMIN };
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;

    const adminPermissions = [
      'manage_users',
      'manage_timetables',
      'view_all_data',
      'system_settings',
      'reports'
    ];

    const hodPermissions = [
      'manage_timetables',
      'view_department_data',
      'manage_department_staff'
    ];

    if (user.userType === 'admin') {
      return adminPermissions.includes(permission);
    } else if (user.userType === 'hod') {
      return hodPermissions.includes(permission);
    }

    return false;
  }

  isAuthenticated(): Observable<boolean> {
    return this.user$.pipe(
      map(user => !!user)
    );
  }

  async updateUserProfile(displayName?: string): Promise<AuthResult> {
    return {
      success: true,
      message: 'Profile updated successfully (Mock Mode).'
    };
  }

  async changePassword(newPassword: string): Promise<AuthResult> {
    return {
      success: true,
      message: 'Password updated successfully (Mock Mode).'
    };
  }
}