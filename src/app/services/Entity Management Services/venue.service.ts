import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { map, catchError, tap, switchMap } from 'rxjs/operators';

export interface Venue {
  id: string;
  name: string;
  area: string;
  autoSchedulable: boolean;
  charge: string;
  createdAt: any;
  deafLoop: boolean;
  defaultCapacity: number;
  department: string;
  roomId: number;
  schedulable: boolean;
  siteName: string;
  staff1Name: string;
  staff2Name: string;
  tags: string[];
  telephone: string;
  updatedAt: any;
  website: string;
  wheelchairAccess: boolean;
}

export interface VenueDisplayInfo {
  id: string;
  name: string;
  type: string; // Derived from tags or area
  capacity: number;
  equipment: string[];
  department: string;
  site: string;
  schedulable: boolean;
  autoSchedulable: boolean;
  accessibility: {
    wheelchairAccess: boolean;
    deafLoop: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class VenueService {
  private venuesCollection: AngularFirestoreCollection<Venue>;
  private venuesSubject = new BehaviorSubject<VenueDisplayInfo[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  venues$ = this.venuesSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  constructor(private firestore: AngularFirestore) {
    this.venuesCollection = this.firestore.collection<Venue>('venues'); // Use 'venue' directly
    console.log('VenueService initialized with collection: venue');
    this.loadVenues().subscribe(); // Make sure to subscribe to trigger the load
  }

  // Load all venues from the database
  loadVenues(): Observable<VenueDisplayInfo[]> {
    console.log('Loading venues from Firestore collection: venue');
    this.loadingSubject.next(true);
    
    return this.venuesCollection.valueChanges({ idField: 'docId' }).pipe(
      tap(venues => {
        console.log('Raw venues from Firestore:', venues);
        console.log('Number of venues retrieved:', venues.length);
        if (venues.length > 0) {
          console.log('First venue sample:', venues[0]);
          console.log('Sample venue fields:', Object.keys(venues[0]));
        }
      }),
      map(venues => {
        // Filter only schedulable venues and transform them
        const schedulableVenues = venues.filter(venue => venue.schedulable || venue.autoSchedulable);
        console.log('Schedulable venues found:', schedulableVenues.length);
        return schedulableVenues.map(venue => this.transformVenueForDisplay(venue));
      }),
      tap(venues => {
        console.log('Transformed venues:', venues);
        this.venuesSubject.next(venues);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error loading venues:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  // Get all venues (for compatibility with existing code)
  getAllVenues(): Observable<VenueDisplayInfo[]> {
    console.log('getAllVenues called');
    
    // Always load fresh data from database
    return this.loadVenues();
  }

  // Get venue by ID
  getVenueById(id: string): Observable<VenueDisplayInfo | null> {
    console.log('Getting venue by ID:', id);
    return this.firestore.doc<Venue>(`venue/${id}`).valueChanges().pipe(
      tap(venue => console.log('Venue retrieved by ID:', venue)),
      map(venue => venue ? this.transformVenueForDisplay(venue) : null),
      catchError(error => {
        console.error('Error getting venue by ID:', error);
        return of(null);
      })
    );
  }

  // Test method to check database connection
  testDatabaseConnection(): Observable<any> {
    console.log('Testing database connection...');
    
    return this.firestore.collection('venue').get().pipe(
      tap(snapshot => {
        console.log('Database connection test - snapshot size:', snapshot.size);
        console.log('Sample documents:', snapshot.docs.slice(0, 3).map(doc => ({ 
          id: doc.id, 
          data: doc.data() 
        })));
      }),
      catchError(error => {
        console.error('Database connection test failed:', error);
        return of(null);
      })
    );
  }

  // Get venues by department
  getVenuesByDepartment(department: string): Observable<VenueDisplayInfo[]> {
    return this.firestore.collection<Venue>('venue', ref => 
      ref.where('department', '==', department)
    ).valueChanges().pipe(
      map(venues => venues.map(venue => this.transformVenueForDisplay(venue))),
      catchError(error => {
        console.error('Error getting venues by department:', error);
        return of([]);
      })
    );
  }

  // Get only schedulable venues
  getSchedulableVenues(): Observable<VenueDisplayInfo[]> {
    return this.venues$.pipe(
      map(venues => venues.filter(venue => venue.schedulable))
    );
  }

  // Get venues by site
  getVenuesBySite(siteName: string): Observable<VenueDisplayInfo[]> {
    return this.venues$.pipe(
      map(venues => venues.filter(venue => venue.site === siteName))
    );
  }

  // Search venues by name or area
  searchVenues(searchTerm: string): Observable<VenueDisplayInfo[]> {
    return this.venues$.pipe(
      map(venues => venues.filter(venue => 
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.type.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );
  }

  // Filter venues by type
  filterVenuesByType(type: string): Observable<VenueDisplayInfo[]> {
    return this.venues$.pipe(
      map(venues => venues.filter(venue => venue.type.toLowerCase() === type.toLowerCase()))
    );
  }

  // Add a new venue
  addVenue(venue: Partial<Venue>): Observable<{ success: boolean, message: string }> {
    const newVenue: Venue = {
      id: venue.id || this.generateVenueId(),
      name: venue.name || '',
      area: venue.area || '',
      autoSchedulable: venue.autoSchedulable || false,
      charge: venue.charge || '',
      createdAt: new Date(),
      deafLoop: venue.deafLoop || false,
      defaultCapacity: venue.defaultCapacity || 0,
      department: venue.department || '',
      roomId: venue.roomId || 0,
      schedulable: venue.schedulable || false,
      siteName: venue.siteName || '',
      staff1Name: venue.staff1Name || '',
      staff2Name: venue.staff2Name || '',
      tags: venue.tags || [],
      telephone: venue.telephone || '',
      updatedAt: new Date(),
      website: venue.website || '',
      wheelchairAccess: venue.wheelchairAccess || false
    };

    return new Observable(observer => {
      this.venuesCollection.doc(newVenue.id).set(newVenue)
        .then(() => {
          observer.next({ success: true, message: 'Venue added successfully' });
          observer.complete();
        })
        .catch(error => {
          console.error('Error adding venue:', error);
          observer.next({ success: false, message: error.message });
          observer.complete();
        });
    });
  }

  // Update a venue
  updateVenue(id: string, updates: Partial<Venue>): Observable<{ success: boolean, message: string }> {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    return new Observable(observer => {
      this.venuesCollection.doc(id).update(updateData)
        .then(() => {
          observer.next({ success: true, message: 'Venue updated successfully' });
          observer.complete();
        })
        .catch(error => {
          console.error('Error updating venue:', error);
          observer.next({ success: false, message: error.message });
          observer.complete();
        });
    });
  }

  // Delete a venue
  deleteVenue(id: string): Observable<{ success: boolean, message: string }> {
    return new Observable(observer => {
      this.venuesCollection.doc(id).delete()
        .then(() => {
          observer.next({ success: true, message: 'Venue deleted successfully' });
          observer.complete();
        })
        .catch(error => {
          console.error('Error deleting venue:', error);
          observer.next({ success: false, message: error.message });
          observer.complete();
        });
    });
  }

  // Get venue utilization stats (for reports)
  getVenueUtilizationStats(): Observable<any[]> {
    return this.venues$.pipe(
      map(venues => venues.map(venue => ({
        id: venue.id,
        name: venue.name,
        type: venue.type,
        capacity: venue.capacity,
        utilizationRate: Math.floor(Math.random() * 100) // Mock data - replace with actual calculation
      })))
    );
  }

  // Private helper methods
  private transformVenueForDisplay(venue: Venue): VenueDisplayInfo {
    console.log('Transforming venue:', venue.name, 'ID:', venue.id);
    
    // Extract building and room from the ID pattern (e.g., "1000_0_NW1")
    const idParts = venue.id.split('_');
    let building = venue.siteName || 'Unknown Site';
    let room = venue.name || 'Unknown Room';
    
    // Try to extract room from the ID if available
    if (idParts.length >= 3) {
      room = idParts[2]; // e.g., "NW1", "L1", etc.
    }
    
    return {
      id: venue.id,
      name: venue.name || 'Unknown Venue',
      type: this.determineVenueType(venue),
      capacity: venue.defaultCapacity || 0,
      equipment: this.parseEquipment(venue),
      department: venue.department || 'General',
      site: venue.siteName || 'Unknown Site',
      schedulable: venue.schedulable || false,
      autoSchedulable: venue.autoSchedulable || false,
      accessibility: {
        wheelchairAccess: venue.wheelchairAccess || false,
        deafLoop: venue.deafLoop || false
      }
    };
  }

  private determineVenueType(venue: Venue): string {
    const name = venue.name?.toLowerCase() || '';
    const id = venue.id?.toLowerCase() || '';
    
    if (name.includes('lecture') || name.includes('theatre')) {
      return 'Lecture Theatre';
    } else if (name.includes('lab') || id.includes('l')) {
      return 'Laboratory';
    } else if (name.includes('room') || name.includes('classroom')) {
      return 'Classroom';
    } else if (name.includes('hall') || name.includes('auditorium')) {
      return 'Hall';
    } else if (name.includes('office')) {
      return 'Office';
    } else if (name.includes('workshop')) {
      return 'Workshop';
    } else if (name.includes('studio')) {
      return 'Studio';
    } else if (id.includes('nw')) {
      return 'Lecture Theatre'; // Based on your NW pattern
    } else if (id.includes('d')) {
      return 'Office'; // Based on your D pattern
    } else if (id.includes('p')) {
      return 'Practical Room'; // Based on your P pattern
    } else {
      return 'Room';
    }
  }

  private parseEquipment(venue: Venue): string[] {
    const equipment: string[] = [];
    
    // Parse equipment from tags (exclude generic tags like "1")
    if (venue.tags && venue.tags.length > 0) {
      const validTags = venue.tags.filter(tag => tag !== '1' && tag.trim() !== '' && tag.length > 1);
      equipment.push(...validTags);
    }
    
    // Add standard equipment based on venue type and capacity
    const type = this.determineVenueType(venue);
    const capacity = venue.defaultCapacity || 0;
    
    switch (type) {
      case 'Lecture Theatre':
        equipment.push('Projector', 'Sound System', 'Microphone');
        if (capacity > 50) {
          equipment.push('Tiered Seating', 'Stage');
        }
        break;
      case 'Laboratory':
        equipment.push('Lab Equipment', 'Computers', 'Safety Equipment', 'Workstations');
        break;
      case 'Classroom':
        equipment.push('Whiteboard', 'Chairs', 'Desks');
        if (capacity > 30) {
          equipment.push('Projector');
        }
        break;
      case 'Practical Room':
        equipment.push('Practical Equipment', 'Tools', 'Safety Equipment');
        break;
      case 'Office':
        equipment.push('Desk', 'Chair', 'Computer');
        break;
      default:
        equipment.push('Basic Furniture');
        break;
    }
    
    // Add accessibility equipment
    if (venue.deafLoop) {
      equipment.push('Hearing Loop');
    }
    
    if (venue.wheelchairAccess) {
      equipment.push('Wheelchair Access');
    }
    
    // Add communication equipment
    if (venue.telephone && venue.telephone.trim() !== '') {
      equipment.push('Telephone');
    }
    
    return [...new Set(equipment)]; // Remove duplicates
  }

  private generateVenueId(): string {
    // Generate an ID similar to your database format
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}_0_GEN${random}`;
  }
}