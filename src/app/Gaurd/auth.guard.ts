import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/Authentication Services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        const isAuthenticated = !!user;
        console.log('🔒 AuthGuard - User authenticated:', isAuthenticated);
        
        if (!isAuthenticated) {
          console.log('🔒 AuthGuard - Redirecting to home (not authenticated)');
          this.router.navigate(['/home'], { replaceUrl: true });
          return false;
        }
        
        return true;
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        console.log('🔧 AdminGuard - Checking user:', user);
        
        if (!user) {
          console.log('🔧 AdminGuard - No user, redirecting to home');
          this.router.navigate(['/home'], { replaceUrl: true });
          return false;
        }
        
        if (user.userType !== 'admin') {
          console.log('🔧 AdminGuard - User is not admin, redirecting based on role');
          
          // Redirect based on user type
          if (user.userType === 'hod') {
            this.router.navigate(['/hod-dash'], { replaceUrl: true });
          } else {
            this.router.navigate(['/home'], { replaceUrl: true });
          }
          return false;
        }
        
        console.log('🔧 AdminGuard - Admin access granted');
        return true;
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class HodGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        console.log('👤 HodGuard - Checking user:', user);
        
        if (!user) {
          console.log('👤 HodGuard - No user, redirecting to home');
          this.router.navigate(['/home'], { replaceUrl: true });
          return false;
        }
        
        // Both HOD and Admin can access HOD dashboard
        if (user.userType !== 'hod' && user.userType !== 'admin') {
          console.log('👤 HodGuard - User is neither HOD nor Admin, redirecting to home');
          this.router.navigate(['/home'], { replaceUrl: true });
          return false;
        }
        
        // If admin is trying to access HOD dash, redirect to admin dash
        if (user.userType === 'admin' && state.url === '/hod-dash') {
          console.log('👤 HodGuard - Admin trying to access HOD dash, redirecting to admin dash');
          this.router.navigate(['/admin-dash'], { replaceUrl: true });
          return false;
        }
        
        console.log('👤 HodGuard - Access granted for:', user.userType);
        return true;
      })
    );
  }
}

// Additional guard to prevent accessing dashboards when not logged in
@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        if (user) {
          // User is logged in, redirect to appropriate dashboard
          console.log('🚫 NoAuthGuard - User is logged in, redirecting to dashboard');
          
          if (user.userType === 'admin') {
            this.router.navigate(['/admin-dash'], { replaceUrl: true });
          } else if (user.userType === 'hod') {
            this.router.navigate(['/hod-dash'], { replaceUrl: true });
          }
          
          return false;
        }
        
        console.log('🚫 NoAuthGuard - No user, allowing access to login page');
        return true;
      })
    );
  }
}