import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

interface VenueFilters {
  type: string;
  minCapacity: number;
  equipment: string[];
}

export interface Venue {
  id: number;
  name: string;
  building?: string;
  room?: string;
  type: string;
  capacity: number;
  equipment: string[];
  image?: string;
  bookings?: Booking[];
}

export interface Booking {
  id: number;
  venueId: number;
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
  imports: [CommonModule, FormsModule, IonicModule]
})
export class VenueAvailComponent implements OnInit {
  // Input property to allow parent component to pass venues
  @Input() venues: Venue[] = [];
  // Output event when a booking request is made
  @Output() bookVenue = new EventEmitter<{venue: Venue, date: Date, startSlot?: number, endSlot?: number}>();

  // View properties
  viewMode: 'list' | 'calendar' = 'list';
  selectedDate: Date = new Date();
  
  // Filter properties
  filters: VenueFilters = {
    type: '',
    minCapacity: 0,
    equipment: []
  };
  
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

  constructor() { }

  ngOnInit() {
    // Initialize with mock data if none provided
    if (this.venues.length === 0) {
      this.initializeMockData();
    }
    
    // Initialize mock bookings
    this.initializeMockBookings();
  }

  // Handle date selection change
  updateDate(event: any) {
    this.selectedDate = new Date(event.detail.value);
  }
  
  // Change view mode between list and calendar
  changeViewMode(mode: 'list' | 'calendar') {
    this.viewMode = mode;
  }
  
  // Apply filters to the venue list
  applyFilters() {
    console.log('Filters applied:', this.filters);
  }
  
  // Get filtered venues based on current filter settings
  getFilteredVenues(): Venue[] {
    return this.venues.filter(venue => {
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
          venue.equipment.includes(item)
        );
        if (!hasAllEquipment) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // Check if venue is available on a specific date and time slot
  isVenueAvailable(venue: Venue, date: Date, timeSlot?: number): boolean {
    if (!timeSlot) {
      // For the list view (full day check)
      const dateString = this.formatDateString(date);
      return !this.bookings.some(booking => 
        booking.venueId === venue.id && 
        booking.date === dateString
      );
    } else {
      // For the calendar view (specific time slot check)
      const dateString = this.formatDateString(date);
      return !this.bookings.some(booking => 
        booking.venueId === venue.id && 
        booking.date === dateString &&
        booking.startSlot <= timeSlot &&
        booking.endSlot > timeSlot
      );
    }
  }
  
  // Check if a specific time slot is booked
  isSlotBooked(venue: Venue, day: number, slot: number): Booking | null {
    const dateString = this.formatDateString(this.selectedDate);
    const booking = this.bookings.find(b => 
      b.venueId === venue.id && 
      b.date === dateString &&
      b.startSlot <= slot &&
      b.endSlot > slot
    );
    
    if (booking) {
      // Store the booking for template access
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
    return date.toISOString().split('T')[0];
  }
  
  // Handle booking request
  handleBooking(venue: Venue, startSlot?: number, endSlot?: number) {
    this.bookVenue.emit({
      venue: venue,
      date: this.selectedDate,
      startSlot: startSlot,
      endSlot: endSlot ? endSlot : (startSlot ? startSlot + 1 : undefined)
    });
  }
  
  // Calculate the grid row span for a booking
  getBookingRowSpan(booking: Booking): string {
    return `span ${booking.endSlot - booking.startSlot}`;
  }
  
  // Initialize mock venues if none provided
  private initializeMockData() {
    this.venues = [
      {
        id: 1,
        name: 'Room A101',
        building: 'Main Building',
        room: 'A101',
        type: 'Classroom',
        capacity: 40,
        equipment: ['Projector', 'Whiteboard'],
        image: 'assets/venue1.jpg'
      },
      {
        id: 2,
        name: 'Lab L201',
        building: 'Science Block',
        room: 'L201',
        type: 'Laboratory',
        capacity: 30,
        equipment: ['Computer Workstations', 'Projector', 'Whiteboard'],
        image: 'assets/venue2.jpg'
      },
      {
        id: 3,
        name: 'Hall H301',
        building: 'Conference Center',
        room: 'H301',
        type: 'Lecture Hall',
        capacity: 120,
        equipment: ['Audio System', 'Projector', 'Smart Board'],
        image: 'assets/venue3.jpg'
      }
    ];
  }
  
  // Initialize mock bookings
  private initializeMockBookings() {
    const today = new Date();
    const formattedDate = this.formatDateString(today);
    
    this.bookings = [
      {
        id: 1,
        venueId: 1,
        date: formattedDate,
        startSlot: 2, // 10:00
        endSlot: 4,   // 12:00
        title: 'Software Engineering',
        module: 'Software Engineering',
        moduleCode: 'CSC2290',
        color: '#4c8dff'
      },
      {
        id: 2,
        venueId: 2,
        date: formattedDate,
        startSlot: 6, // 14:00
        endSlot: 8,   // 16:00
        title: 'Database Lab',
        module: 'Database Systems',
        moduleCode: 'CSC2291',
        color: '#ffc409'
      }
    ];
  }
}
