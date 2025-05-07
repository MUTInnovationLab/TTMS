import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // BehaviorSubject to track sidebar visibility state
  public sidebarVisibleSubject = new BehaviorSubject<boolean>(true); // Default to true for desktop view
  
  // Observable that components can subscribe to
  sidebarVisible$ = this.sidebarVisibleSubject.asObservable();
  
  constructor() {
    console.log('SidebarService initialized with sidebar visible:', this.sidebarVisibleSubject.value);
    
    // Check if mobile view on init and adjust accordingly
    this.checkScreenSize();
    
    // Add resize listener to adjust sidebar based on screen size
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }
  
  // Toggle sidebar visibility
  toggleSidebar() {
    const currentState = this.sidebarVisibleSubject.value;
    const newState = !currentState;
    console.log(`SidebarService: Toggling from ${currentState} to ${newState}`);
    this.sidebarVisibleSubject.next(newState);
  }
  
  // Show sidebar
  showSidebar() {
    console.log('SidebarService: Showing sidebar');
    this.sidebarVisibleSubject.next(true);
  }
  
  // Hide sidebar
  hideSidebar() {
    console.log('SidebarService: Hiding sidebar');
    this.sidebarVisibleSubject.next(false);
  }
  
  // Get current sidebar state
  get isSidebarVisible(): boolean {
    return this.sidebarVisibleSubject.value;
  }
  
  // Check screen size and adjust sidebar visibility
  private checkScreenSize() {
    if (window.innerWidth < 768) {
      // On mobile, default to hidden
      this.sidebarVisibleSubject.next(false);
    }
  }
}
