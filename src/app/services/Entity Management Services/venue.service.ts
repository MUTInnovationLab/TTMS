import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { doc, setDoc } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class VenueService {
  constructor(private firestore: AngularFirestore) {}

  async addVenue(venueData: any): Promise<void> {
    // Get the underlying Firestore instance from AngularFire
    const db = this.firestore.firestore;
    
    // Create a document reference with custom ID
    const docRef = doc(db, 'venues', venueData.id);
    
    // Set the document data
    return setDoc(docRef, venueData);
  }
}