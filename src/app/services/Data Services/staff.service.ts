import { Injectable, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { User } from '../../components/add-user/add-user.component';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { catchError, map } from 'rxjs/operators';

// Import Firebase directly for operations that cause DI issues
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  
  // Collection name in Firestore
  private readonly STAFF_COLLECTION = 'staff';
  
  constructor(
    private firestore: AngularFirestore,
    private ngZone: NgZone
  ) { }
  
  // Add a new staff member (HOD) to the collection
  addStaffMember(userData: User): Observable<{ success: boolean, message: string }> {
    // Format the data according to your collection structure
    const staffData = {
      id: userData.id,
      title: userData.title,
      name: userData.name,
      sex: userData.sex || '',
      department: userData.department,
      roomName: userData.roomName || '',
      schedulable: userData.schedulable || false,
      role: userData.role,
      contact: userData.contact || {},
      address: userData.address || {},
      accessibility: userData.accessibility || {
        deafLoop: false,
        wheelchairAccess: false
      },
      weeklyTarget: userData.weeklyTarget || 0,
      totalTarget: userData.totalTarget || 0,
      allowanceWeek: 0,
      allowanceTotal: 0,
      profile: '',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Use department name as document ID in Firestore
    const documentId = userData.department;
    
    console.log('Writing staff data to Firestore:', documentId, staffData);
    
    // Use raw Firebase API to avoid Angular DI context issues
    return from(new Promise<void>((resolve, reject) => {
      try {
        // Get current Firebase app instance
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Use direct Firebase API to write to Firestore
        firestore.collection(this.STAFF_COLLECTION).doc(documentId).set(staffData)
          .then(() => {
            console.log('Staff document written successfully!');
            resolve();
          })
          .catch(error => {
            console.error('Error adding staff document:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      map(() => ({
        success: true,
        message: 'Staff record created successfully'
      })),
      catchError(error => {
        console.error('Error in addStaffMember:', error);
        return of({
          success: false,
          message: `Failed to create staff record: ${error.message}`
        });
      })
    );
  }
  
  // Get all staff members
  getAllStaff(): Observable<any[]> {
    // Use raw Firebase API for consistency
    return from(new Promise<any[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.STAFF_COLLECTION).get()
          .then(snapshot => {
            const staff = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            resolve(staff);
          })
          .catch(error => {
            console.error('Error fetching staff records:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getAllStaff:', error);
        return of([]);
      })
    );
  }
  
  // Get all Heads of Department
  getAllHODs(): Observable<any[]> {
    // Use raw Firebase API for consistency
    return from(new Promise<any[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Query for staff with role = 'HOD'
        firestore.collection(this.STAFF_COLLECTION)
          .where('role', '==', 'HOD')
          .get()
          .then(snapshot => {
            const hods = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data() as Record<string, any>
            }));
            console.log('Retrieved HODs from Firestore:', hods);
            resolve(hods);
          })
          .catch(error => {
            console.error('Error fetching HOD records:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase for HODs:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getAllHODs:', error);
        return of([]);
      })
    );
  }
  
  // Get staff member by department
  getStaffByDepartment(department: string): Observable<any | null> {
    // Use raw Firebase API for consistency
    return from(new Promise<any>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.STAFF_COLLECTION).doc(department).get()
          .then(doc => {
            if (doc.exists) {
              resolve({
                id: doc.id,
                ...doc.data()
              });
            } else {
              resolve(null);
            }
          })
          .catch(error => {
            console.error('Error fetching staff record:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getStaffByDepartment:', error);
        return of(null);
      })
    );
  }
}

