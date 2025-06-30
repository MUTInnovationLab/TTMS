import { Injectable, NgZone } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { User } from '../../components/add-user/add-user.component';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

// Import Firebase directly for the specific operations that cause DI issues
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth'; // Add this import

export interface AuthAccount {
  email: string;
  password: string;
  role: string;
  uid?: string;
  isFirstLogin?: boolean;
}

export interface AuthState {
  uid: string | null;
  email: string | null;
  role: string | null;
  isFirstLogin: boolean;
  isLoggedIn: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  // Collection for user roles in Firestore
  private readonly USER_ROLES_COLLECTION = 'user_roles';
  
  // User authentication state
  private authState = new BehaviorSubject<AuthState>({
    uid: null,
    email: null,
    role: null,
    isFirstLogin: false,
    isLoggedIn: false
  });
  
  // Observable for components to subscribe to auth state
  currentAuthState$ = this.authState.asObservable();
  
  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private ngZone: NgZone
  ) {
    // Use the raw Firebase Auth API to listen for auth state changes
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        // User is signed in, get their role from Firestore using raw API
        try {
          const firebaseApp = firebase.app();
          const firestore = firebaseApp.firestore();
          
          firestore.collection(this.USER_ROLES_COLLECTION).doc(user.uid).get()
            .then(docSnapshot => {
              if (docSnapshot.exists) {
                const userData = docSnapshot.data() as Record<string, any>;
                this.authState.next({
                  uid: user.uid,
                  email: user.email,
                  role: userData ? userData['role'] : null,
                  isFirstLogin: userData ? userData['isFirstLogin'] || false : false,
                  isLoggedIn: true
                });
              } else {
                // User exists in auth but not in roles collection
                this.authState.next({
                  uid: user.uid,
                  email: user.email,
                  role: null,
                  isFirstLogin: false,
                  isLoggedIn: true
                });
              }
            })
            .catch(error => {
              console.error('Error fetching user role:', error);
              this.authState.next({
                uid: user.uid,
                email: user.email,
                role: null,
                isFirstLogin: false,
                isLoggedIn: true
              });
            });
        } catch (error) {
          console.error('Error accessing Firebase:', error);
          this.authState.next({
            uid: user.uid,
            email: user.email,
            role: null,
            isFirstLogin: false,
            isLoggedIn: true
          });
        }
      } else {
        // User is signed out
        this.authState.next({
          uid: null,
          email: null,
          role: null,
          isFirstLogin: false,
          isLoggedIn: false
        });
      }
    });
  }
  
  // Create a new authentication account for a staff member
  createUserAccount(email: string, role: string, defaultPassword: string = 'TTMS@123'): Observable<{ success: boolean, message: string, account?: AuthAccount }> {
    console.log('Creating Firebase auth account for:', email, 'with role:', role);
    
    // Create the user with Firebase Authentication
    return from(this.afAuth.createUserWithEmailAndPassword(email, defaultPassword))
      .pipe(
        tap(userCredential => console.log('Firebase user created successfully:', userCredential.user?.uid)),
        switchMap(userCredential => {
          const user = userCredential.user;
          
          if (!user) {
            throw new Error('Failed to create user - user object is null');
          }
          
          const uid = user.uid;
          
          // Use raw Firebase API to avoid Angular DI context issues
          return from(new Promise<void>((resolve, reject) => {
            try {
              // Get current Firebase app instance
              const firebaseApp = firebase.app();
              const firestore = firebaseApp.firestore();
              
              // Create document using direct Firebase API
              firestore.collection(this.USER_ROLES_COLLECTION).doc(uid).set({
                email,
                role,
                isFirstLogin: true,
                createdAt: new Date()
              })
              .then(() => {
                console.log('User role document created in Firestore');
                resolve();
              })
              .catch(error => {
                console.error('Error creating user role document:', error);
                reject(error);
              });
            } catch (error) {
              console.error('Error accessing Firebase:', error);
              reject(error);
            }
          })).pipe(
            map(() => {
              const newAccount: AuthAccount = {
                email,
                password: defaultPassword,
                role,
                uid,
                isFirstLogin: true
              };
              return {
                success: true,
                message: 'Account created successfully',
                account: newAccount
              };
            })
          );
        }),
        catchError(error => {
          console.error('Error creating Firebase auth account:', error);
          return of({
            success: false,
            message: `Failed to create account: ${error.message}`
          });
        })
      );
  }
  
  // Generate a secure default password
  generateDefaultPassword(): string {
    // Simple random password generation - in real app, use a stronger method
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = 'TTMS-';
    for (let i = 0; i < 8; i++) {
      password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return password;
  }
  
  // Get all auth accounts (for admin purposes only)
  getAuthAccounts(): Observable<any[]> {
    // Use a safer approach with the raw Firebase API
    return from(new Promise<any[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.USER_ROLES_COLLECTION).get()
          .then(snapshot => {
            const accounts = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            resolve(accounts);
          })
          .catch(error => {
            console.error('Error fetching user roles:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getAuthAccounts:', error);
        return of([]);
      })
    );
  }
  
  // Additional method to check if email already exists
  checkEmailExists(email: string): Observable<boolean> {
    return from(this.afAuth.fetchSignInMethodsForEmail(email))
      .pipe(
        map(methods => methods.length > 0),
        catchError(() => of(false))
      );
  }
  
  // Login with email/password
  login(email: string, password: string): Observable<{ success: boolean, message: string, role?: string, isFirstLogin?: boolean }> {
    console.log('Attempting login for:', email);
    
    return from(this.afAuth.signInWithEmailAndPassword(email, password))
      .pipe(
        switchMap(userCredential => {
          const user = userCredential.user;
          
          if (!user) {
            throw new Error('User not found after successful login');
          }
          
          const uid = user.uid;
          
          // Use raw Firebase API to avoid Angular DI context issues
          return from(new Promise<{ success: boolean, message: string, role?: string, isFirstLogin?: boolean }>((resolve, reject) => {
            try {
              // Get current Firebase app instance
              const firebaseApp = firebase.app();
              const firestore = firebaseApp.firestore();
              
              // Get user role document using direct Firebase API
              firestore.collection(this.USER_ROLES_COLLECTION).doc(uid).get()
                .then(docSnapshot => {
                  if (docSnapshot.exists) {
                    const userData = docSnapshot.data() as Record<string, any>;
                    
                    // Update the auth state BEFORE returning from login
                    this.authState.next({
                      uid: user.uid,
                      email: user.email,
                      role: userData ? userData['role'] : null,
                      isFirstLogin: userData ? userData['isFirstLogin'] || false : false,
                      isLoggedIn: true
                    });
                    
                    resolve({
                      success: true,
                      message: 'Login successful',
                      role: userData ? userData['role'] : undefined,
                      isFirstLogin: userData ? userData['isFirstLogin'] || false : false
                    });
                  } else {
                    resolve({
                      success: false,
                      message: 'User role not found'
                    });
                  }
                })
                .catch(error => {
                  console.error('Error fetching user role:', error);
                  reject(error);
                });
            } catch (error) {
              console.error('Error accessing Firebase:', error);
              reject(error);
            }
          }));
        }),
        catchError(error => {
          console.error('Login error:', error);
          let errorMessage = 'An unknown error occurred';
          
          // Provide user-friendly error messages
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format';
          } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled';
          } else {
            errorMessage = error.message || errorMessage;
          }
          
          return of({
            success: false,
            message: errorMessage
          });
        })
      );
  }
  
  // Logout the current user
  logout(): Observable<boolean> {
    return from(this.afAuth.signOut()).pipe(
      tap(() => {
        // Immediately update auth state (don't wait for the subscription)
        this.authState.next({
          uid: null,
          email: null,
          role: null,
          isFirstLogin: false,
          isLoggedIn: false
        });
        
        // Navigate to home/login page
        this.ngZone.run(() => {
          this.router.navigate(['/home']);
        });
      }),
      map(() => true),
      catchError(error => {
        console.error('Logout error:', error);
        return of(false);
      })
    );
  }
  
  // Update first login status after password change
  updateFirstLoginStatus(uid: string, isFirstLogin: boolean): Observable<boolean> {
    return from(this.firestore.doc(`${this.USER_ROLES_COLLECTION}/${uid}`).update({
      isFirstLogin
    })).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error updating first login status:', error);
        return of(false);
      })
    );
  }
  
  // Navigate based on user role - update to wait for auth state to be ready
  navigateByRole(role: string, isFirstLogin: boolean): void {
    const currentState = this.authState.getValue();
    
    // Only navigate if we have uid
    if (!currentState.uid) {
      console.warn('Attempting to navigate without valid user session');
    }
    
    this.ngZone.run(() => {
      if (isFirstLogin) {
        // Rather than navigate immediately, wait a brief moment to ensure auth state is stabilized
        setTimeout(() => {
          console.log('Navigating to change-password, auth state:', this.authState.getValue());
          this.router.navigate(['/change-password']);
        }, 500);
      } else {
        // Route based on role
        switch (role.toLowerCase()) {
          case 'admin':
            this.router.navigate(['/admin-dash']);
            break;
          case 'hod':
            this.router.navigate(['/hod-dash']);
            break;
          case 'lecturer':
            this.router.navigate(['/lecturer-dash']);
            break;
          default:
            // Unknown role, redirect to home
            this.router.navigate(['/home']);
            break;
        }
      }
    });
  }
  
  // Add a method for password reset
  sendPasswordResetEmail(email: string): Observable<{success: boolean, message: string}> {
    return from(this.afAuth.sendPasswordResetEmail(email))
      .pipe(
        map(() => ({
          success: true,
          message: 'Password reset email sent successfully'
        })),
        catchError(error => {
          console.error('Error sending password reset email:', error);
          let message = 'Failed to send password reset email';
          
          if (error.code === 'auth/user-not-found') {
            message = 'No account found with this email address';
          } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email format';
          }
          
          return of({
            success: false,
            message
          });
        })
      );
  }
  
  // Reauthenticate the user (required before changing password)
  reauthenticate(email: string, password: string): Observable<{ success: boolean, message: string }> {
    try {
      const user = firebase.auth().currentUser;
      
      if (!user) {
        console.error('No user is currently signed in');
        return of({
          success: false,
          message: 'No authenticated user found. Please login again.'
        });
      }
      
      // Create credential with email and password
      const credential = firebase.auth.EmailAuthProvider.credential(email, password);
      
      // Return observable of reauthentication operation
      return from(user.reauthenticateWithCredential(credential)).pipe(
        map(() => ({
          success: true,
          message: 'User reauthenticated successfully'
        })),
        catchError(error => {
          console.error('Reauthentication error:', error);
          let message = 'Failed to reauthenticate';
          
          // Handle specific error cases
          if (error.code === 'auth/wrong-password') {
            message = 'Current password is incorrect';
          } else if (error.code === 'auth/invalid-credential') {
            message = 'Invalid credentials. Please try again or sign out and sign back in.';
          } else if (error.code === 'auth/user-mismatch') {
            message = 'Provided credentials do not match the current user';
          } else if (error.code === 'auth/user-token-expired') {
            message = 'Your session has expired. Please sign in again.';
          } else {
            message = error.message || message;
          }
          
          return of({
            success: false,
            message
          });
        })
      );
    } catch (error) {
      console.error('Error in reauthenticate method:', error);
      return of({
        success: false,
        message: 'An unexpected error occurred during authentication'
      });
    }
  }
  
  // Change user password
  changePassword(newPassword: string): Observable<{ success: boolean, message: string }> {
    const user = firebase.auth().currentUser;
    
    if (!user) {
      return of({
        success: false,
        message: 'No authenticated user found'
      });
    }
    
    // For security, add a minimum password strength requirement
    if (newPassword.length < 8) {
      return of({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // First check if this is a first-time login from auth state
    const currentAuthState = this.authState.getValue();
    let isFirstLogin = false;
    
    if (currentAuthState && currentAuthState.isFirstLogin) {
      isFirstLogin = true;
      console.log('First-time login detected, allowing password change without reauthentication');
    }
    
    return from(user.updatePassword(newPassword)).pipe(
      map(() => ({
        success: true,
        message: 'Password updated successfully'
      })),
      catchError(error => {
        console.error('Password update error:', error);
        let message = 'Failed to update password';
        
        if (error.code === 'auth/weak-password') {
          message = 'Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/requires-recent-login') {
          message = 'For security reasons, please sign out and sign in again before changing your password.';
        } else {
          message = error.message || message;
        }
        
        return of({
          success: false,
          message
        });
      })
    );
  }
  
  // Add a special method to handle first-time login password change
  resetDefaultPassword(email: string, newPassword: string): Observable<{ success: boolean, message: string }> {
    // First, get current user to check if they match the provided email
    const user = firebase.auth().currentUser;
    
    if (!user || user.email !== email) {
      return of({
        success: false,
        message: 'User email does not match current session'
      });
    }
    
    // For first-time login, directly update password
    return from(user.updatePassword(newPassword)).pipe(
      map(() => ({
        success: true,
        message: 'Password successfully updated'
      })),
      catchError(error => {
        console.error('Error resetting default password:', error);
        let message = 'Failed to update password';
        
        if (error.code === 'auth/requires-recent-login') {
          message = 'Session expired. Please sign in again to change your password.';
        } else if (error.code === 'auth/weak-password') {
          message = 'Password is too weak. Please use a stronger password.';
        } else {
          message = error.message || message;
        }
        
        return of({
          success: false,
          message
        });
      })
    );
  }
  
  // Add a method to force refresh the current user
  refreshCurrentUser(): Observable<boolean> {
    const user = firebase.auth().currentUser;
    
    if (!user) {
      return of(false);
    }
    
    return from(user.reload()).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error refreshing user:', error);
        return of(false);
      })
    );
  }
}
