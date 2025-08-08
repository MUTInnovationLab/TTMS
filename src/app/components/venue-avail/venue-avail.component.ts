import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SessionService } from '../../services/Timetable Core Services/session.service';
import { VenueService, VenueDisplayInfo } from '../../services/Entity Management Services/venue.service';
import { HighlightPipe } from '../../pipes/highlight.pipe';

interface VenueFilters {
  type: string;
  minCapacity: number;
  equipment: string[];
}

export interface Venue {
  id: string;
  name: string;
  building?: string; // Optional for database venues
  room?: string; // Optional for database venues
  type: string;
  capacity: number;
  equipment: string[];
  description?: string; // Optional for database venues
  floor?: number; // Optional for database venues
  availability?: boolean; // Optional for database venues, true by default
  image?: string; // Optional for database venues
  department?: string; // From database
  site?: string; // From database
  schedulable?: boolean; // From database
  autoSchedulable?: boolean; // From database
  accessibility?: { // From database
    wheelchairAccess: boolean;
    deafLoop: boolean;
  };
}

export interface Booking {
  id: number;
  venueId: string;
  date: string;
  startSlot: number;
  endSlot: number;
  title: string;
  module?: string;
  moduleCode?: string;
  color?: string;
}

@Component({
  selector: 'app-venue-avail',
  templateUrl: './venue-avail.component.html',
  styleUrls: ['./venue-avail.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HighlightPipe]
})
export class VenueAvailComponent implements OnInit, OnChanges {
  // Input property to allow parent component to pass venues
  @Input() venues: Venue[] = [];
  @Input() session: any = null;
  // Output event when a booking request is made
  @Output() venueBooked = new EventEmitter<{venue: Venue, date: Date, startSlot?: number, endSlot?: number}>();
  @Output() modalClosed = new EventEmitter<void>();

  // View properties
  viewMode: 'list' | 'calendar' = 'list';
  selectedDate: Date = new Date();
  
  // Filter properties
  filters: VenueFilters = {
    type: '',
    minCapacity: 0,
    equipment: []
  };
  
  // Search properties
  searchQuery: string = '';
  
  // Data for dropdown options
  venueTypes: string[] = ['Classroom', 'Laboratory', 'Lecture Hall', 'Seminar Room', 'Conference Room'];
  equipmentOptions: string[] = ['Projector', 'Whiteboard', 'Computer Workstations', 'Smart Board', 'Audio System', 'Video Conferencing'];
  
  // Time slots for calendar view
  timeSlots = [
    { id: 0, time: '08:00' },
    { id: 1, time: '09:00' },
    { id: 2, time: '10:00' },
    { id: 3, time: '11:00' },
    { id: 4, time: '12:00' },
    { id: 5, time: '13:00' },
    { id: 6, time: '14:00' },
    { id: 7, time: '15:00' },
    { id: 8, time: '16:00' },
    { id: 9, time: '17:00' }
  ];
  
  // Day names for calendar view
  days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Bookings data
  bookings: Booking[] = [];
  // Temporary storage for session display
  currentBooking: Booking | null = null;

  // Add loading state
  isLoading = false;
  loadError: string | null = null;
  hasTriedLoading = false;

  constructor(
    private sessionService: SessionService,
    private venueService: VenueService
  ) { }

  ngOnInit() {
    console.log('VenueAvailComponent initialized');
    console.log('Initial venues provided:', this.venues?.length || 0);
    
    // Always try to load venues if none provided or if array is empty
    if (!this.venues || this.venues.length === 0) {
      console.log('No venues provided via input, loading from VenueService');
      this.loadVenuesFromService();
    } else {
      console.log('Using provided venues:', this.venues.length);
      this.venues = this.venues.map(venue => this.normalizeVenueData(venue));
      console.log('Normalized venues:', this.venues.length);
    }
    
    // Initialize mock bookings
    this.initializeMockBookings();
  }

  // Load venues from the VenueService
  private loadVenuesFromService() {
    if (this.hasTriedLoading && this.isLoading) {
      console.log('Already loading venues, skipping...');
      return;
    }

    this.isLoading = true;
    this.loadError = null;
    this.hasTriedLoading = true;
    
    console.log('Loading venues from VenueService...');
    
    this.venueService.getAllVenues().subscribe({
      next: (venueDisplayInfos: VenueDisplayInfo[]) => {
        console.log('Venues loaded from service:', venueDisplayInfos.length);
        
        if (venueDisplayInfos.length === 0) {
          this.loadError = 'No venues found in the database';
          console.warn('No venues found');
        } else {
          // Convert VenueDisplayInfo to Venue format
          this.venues = venueDisplayInfos.map(venueInfo => this.convertDisplayInfoToVenue(venueInfo));
          console.log('Converted venues for component:', this.venues.length);
          console.log('Sample converted venue:', this.venues[0]);
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading venues from service:', error);
        this.loadError = `Failed to load venues: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  // Convert VenueDisplayInfo to Venue format for component compatibility
  private convertDisplayInfoToVenue(venueInfo: VenueDisplayInfo): Venue {
    return {
      id: venueInfo.id,
      name: venueInfo.name,
      type: venueInfo.type,
      capacity: venueInfo.capacity,
      equipment: venueInfo.equipment,
      department: venueInfo.department,
      site: venueInfo.site,
      schedulable: venueInfo.schedulable,
      autoSchedulable: venueInfo.autoSchedulable,
      accessibility: venueInfo.accessibility,
      // Add the optional properties expected by the component
      building: venueInfo.site,
      room: this.extractRoomFromName(venueInfo.name),
      image: 'assets/default-venue.jpg',
      description: `${venueInfo.type} located at ${venueInfo.site} with capacity of ${venueInfo.capacity}`,
      floor: this.extractFloorFromId(venueInfo.id),
      availability: true
    };
  }

  // Extract room identifier from venue name or ID
  private extractRoomFromName(name: string): string {
    // Try to extract room identifier from name like "LECTURE THEATRE - NW1"
    const match = name.match(/- (\w+\d+)$/);
    if (match) {
      return match[1];
    }
    
    // Fallback to the name itself
    return name;
  }

  // Extract floor from venue ID pattern (e.g., "1000_0_NW1" -> floor 0)
  private extractFloorFromId(id: string): number {
    const parts = id.split('_');
    if (parts.length >= 2) {
      const floorStr = parts[1];
      const floor = parseInt(floorStr);
      return isNaN(floor) ? 0 : floor;
    }
    return 0;
  }

  // Add method to handle when venues are updated from parent
  ngOnChanges(changes: any) {
    if (changes.venues && changes.venues.currentValue) {
      console.log('Venues updated in component via ngOnChanges:', changes.venues.currentValue.length);
      if (changes.venues.currentValue.length > 0) {
        this.venues = changes.venues.currentValue.map((venue: any) => this.normalizeVenueData(venue));
        console.log('Updated venues after normalization:', this.venues.length);
        // Reset loading states since we have data
        this.isLoading = false;
        this.loadError = null;
      }
    }
  }

  // Reload venues manually
  reloadVenues() {
    console.log('Manually reloading venues...');
    this.loadVenuesFromService();
  }

  // Normalize venue data to ensure all required properties exist
  private normalizeVenueData(venue: any): Venue {
    return {
      id: venue.id || 'unknown',
      name: venue.name || 'Unknown Venue',
      type: venue.type || 'Unknown',
      capacity: venue.capacity || 0,
      equipment: venue.equipment || [],
      department: venue.department || '',
      site: venue.site || venue.building || 'Unknown Site',
      schedulable: venue.schedulable !== false,
      autoSchedulable: venue.autoSchedulable !== false,
      accessibility: venue.accessibility || { wheelchairAccess: false, deafLoop: false },
      building: venue.building || venue.site || 'Unknown Building',
      room: venue.room || venue.name || 'Unknown Room',
      image: venue.image || 'assets/default-venue.jpg',
      description: venue.description || `${venue.type || 'Venue'} with capacity of ${venue.capacity || 0}`
    };
  }

  // Handle date selection change
  updateDate(event: any) {
    this.selectedDate = new Date(event.detail.value);
    console.log('Date updated to:', this.selectedDate);
  }
  
  // Change view mode between list and calendar
  changeViewMode(mode: 'list' | 'calendar') {
    this.viewMode = mode;
    console.log('View mode changed to:', mode);
  }
  
  // Apply filters to the venue list
  applyFilters() {
    console.log('Filters applied:', this.filters);
    // Force re-render by triggering change detection
    this.venues = [...this.venues];
  }
  
  // Get filtered venues based on current filter settings and search query
  getFilteredVenues(): Venue[] {
    if (this.isLoading) {
      console.log('Still loading venues...');
      return [];
    }
    
    if (!this.venues || this.venues.length === 0) {
      console.warn('No venues available for filtering. Venues array:', this.venues);
      return [];
    }
    
    console.log('Filtering from', this.venues.length, 'venues');
    
    let filtered = this.venues.filter(venue => {
      // Only show schedulable venues
      if (!venue.schedulable && !venue.autoSchedulable) {
        return false;
      }
      
      // Search filter
      if (this.searchQuery && this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase().trim();
        const searchableText = [
          venue.name,
          venue.type,
          venue.building || '',
          venue.room || '',
          venue.site || '',
          venue.department || '',
          ...(venue.equipment || [])
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }
      
      // Type filter
      if (this.filters.type && venue.type !== this.filters.type) {
        return false;
      }
      
      // Capacity filter
      if (this.filters.minCapacity && venue.capacity < this.filters.minCapacity) {
        return false;
      }
      
      // Equipment filter
      if (this.filters.equipment && this.filters.equipment.length > 0) {
        const hasAllEquipment = this.filters.equipment.every(item => 
          venue.equipment && venue.equipment.includes(item)
        );
        if (!hasAllEquipment) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log('Filtered venues count:', filtered.length);
    return filtered;
  }
  
  // Check if venue is available on a specific date and time slot
  isVenueAvailable(venue: Venue, date: Date, timeSlot?: number): boolean {
    if (!venue || !date) {
      return false;
    }
    
    if (timeSlot === undefined) {
      // For the list view (full day check)
      const dateString = this.formatDateString(date);
      const hasBookings = this.bookings.some(booking => 
        booking.venueId === venue.id && 
        booking.date === dateString
      );
      return !hasBookings;
    } else {
      // For the calendar view (specific time slot check)
      const dateString = this.formatDateString(date);
      const isBooked = this.bookings.some(booking => 
        booking.venueId === venue.id && 
        booking.date === dateString &&
        booking.startSlot <= timeSlot &&
        booking.endSlot > timeSlot
      );
      return !isBooked;
    }
  }
  
  // Check if a specific time slot is booked
  isSlotBooked(venue: Venue, day: number, slot: number): Booking | null {
    if (!venue) {
      return null;
    }
    
    const dateString = this.formatDateString(this.selectedDate);
    const booking = this.bookings.find(b => 
      b.venueId === venue.id && 
      b.date === dateString &&
      b.startSlot <= slot &&
      b.endSlot > slot
    );
    
    if (booking) {
      this.currentBooking = booking;
      return booking;
    }
    
    this.currentBooking = null;
    return null;
  }
  
  // Check if a slot is the starting point of a booking
  isSlotStart(venue: Venue, day: number, slot: number, booking: Booking): boolean {
    return booking && booking.startSlot === slot;
  }
  
  // Get day number from a date
  getDayFromDate(date: Date): number {
    return date.getDay();
  }
  
  // Format date to string for comparisons
  private formatDateString(date: Date): string {
    try {
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Handle booking request
  handleBooking(venue: Venue, startSlot?: number, endSlot?: number) {
    console.log('Handling booking for venue:', venue, 'slots:', startSlot, endSlot);
    this.bookVenue(venue, startSlot, endSlot);
  }

  bookVenue(venue: Venue, startSlot?: number, endSlot?: number) {
    console.log('Booking venue:', venue, 'from slot', startSlot, 'to slot', endSlot);
    
    // Emit the venue booking event with the correct structure
    this.venueBooked.emit({
      venue: venue,
      date: this.selectedDate,
      startSlot: startSlot,
      endSlot: endSlot
    });
  }
  
  // Calculate the grid row span for a booking
  getBookingRowSpan(booking: Booking): string {
    if (!booking || booking.endSlot === undefined || booking.startSlot === undefined) {
      return 'span 1';
    }
    return `span ${booking.endSlot - booking.startSlot}`;
  }
  
  // Get venue display name
  getVenueDisplayName(venue: Venue): string {
    if (!venue) return 'Unknown Venue';
    return venue.name || `${venue.building} - ${venue.room}` || 'Unknown Venue';
  }
  
  // Get venue location string
  getVenueLocation(venue: Venue): string {
    if (!venue) return 'Unknown Location';
    
    const building = venue.building || 'Unknown Building';
    const room = venue.room || venue.name || 'Unknown Room';
    
    return `${building}, Room ${room}`;
  }
  
  // Get venue capacity display
  getVenueCapacity(venue: Venue): number {
    return venue?.capacity || 0;
  }
  
  // Get venue type display
  getVenueType(venue: Venue): string {
    return venue?.type || 'Unknown Type';
  }
  
  // Get venue equipment list
  getVenueEquipment(venue: Venue): string[] {
    return venue?.equipment || [];
  }
  
  // Get venue image
  getVenueImage(venue: Venue): string {
    return venue?.image || 'assets/default-venue.jpg';
  }
  
  // Initialize mock venues if none provided
  // private initializeMockData() {
  //   console.log('Mock data initialization disabled - venues should come from database');
  // }

  // Initialize mock bookings
  private initializeMockBookings() {
    const today = new Date();
    const formattedDate = this.formatDateString(today);
    
    this.bookings = [ ];
    
    console.log('Mock bookings initialized:', this.bookings);
  }

  // Add trackBy function for better performance
  trackVenueById(index: number, venue: Venue): string | number {
    return venue?.id || index;
  }

  // Add method to handle image loading errors with proper typing
  onImageError(event: Event, venue: Venue) {
    console.warn('Failed to load image for venue:', venue.name);
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/default-venue.jpg';
      target.classList.add('error');
    }
  }

  // Add debugging method
  debugVenue(venue: Venue) {
    console.log('Venue debug info:', {
      venue,
      name: this.getVenueDisplayName(venue),
      location: this.getVenueLocation(venue),
      capacity: this.getVenueCapacity(venue),
      type: this.getVenueType(venue),
      equipment: this.getVenueEquipment(venue),
      available: this.isVenueAvailable(venue, this.selectedDate)
    });
  }

  // Helper methods for compact layout
  getAvailabilityColor(venue: Venue): string {
    const availableSlots = this.timeSlots.filter(slot => 
      this.isVenueAvailable(venue, this.selectedDate, slot.id)
    ).length;
    
    const totalSlots = this.timeSlots.length;
    const availability = availableSlots / totalSlots;
    
    if (availability >= 0.8) return 'success';
    if (availability >= 0.5) return 'warning';
    return 'danger';
  }

  getAvailabilityStatus(venue: Venue): string {
    const availableSlots = this.timeSlots.filter(slot => 
      this.isVenueAvailable(venue, this.selectedDate, slot.id)
    ).length;
    
    const totalSlots = this.timeSlots.length;
    const availability = availableSlots / totalSlots;
    
    if (availability >= 0.8) return `${availableSlots}/${totalSlots} Available`;
    if (availability >= 0.5) return `${availableSlots}/${totalSlots} Partial`;
    return `${availableSlots}/${totalSlots} Busy`;
  }

  getShortTime(timeString: string): string {
    // Convert "07:45 - 08:25" to "07:45"
    return timeString.split(' - ')[0];
  }

  // Search functionality methods
  onSearchInput(event: any) {
    this.searchQuery = event.target.value;
    console.log('Search query updated:', this.searchQuery);
    console.log('Filtered venues after search:', this.getFilteredVenues().length);
    // The filtering will happen automatically through the template binding
  }

  clearSearch() {
    this.searchQuery = '';
    console.log('Search cleared');
  }

  // Check if any filters are currently active
  hasActiveFilters(): boolean {
    return !!(
      this.filters.type ||
      this.filters.minCapacity > 0 ||
      (this.filters.equipment && this.filters.equipment.length > 0) ||
      (this.searchQuery && this.searchQuery.trim())
    );
  }

  // Clear all filters and search
  clearAllFilters() {
    this.filters = {
      type: '',
      minCapacity: 0,
      equipment: []
    };
    this.searchQuery = '';
    console.log('All filters and search cleared');
  }
}
