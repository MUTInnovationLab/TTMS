import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // BehaviorSubject to track sidebar visibility state
  public sidebarVisibleSubject = new BehaviorSubject<boolean>(false);
  
  // Observable that components can subscribe to
  sidebarVisible$ = this.sidebarVisibleSubject.asObservable();
  
  constructor() {
    console.log('SidebarService initialized');
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
}
