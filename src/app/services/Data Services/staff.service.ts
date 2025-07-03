import { Injectable, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { User } from '../../components/add-user/add-user.component';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { catchError, map } from 'rxjs/operators';
import { Module } from '../Entity Management Services/module.service';

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
  
  // Add a lecturer to a department's lecturers array
  addLecturerToDepartment(departmentName: string, lecturerData: User): Observable<{ success: boolean, message: string }> {
    console.log('Adding lecturer to department:', departmentName, lecturerData);
    
    return from(new Promise<void>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Get the department document
        firestore.collection(this.STAFF_COLLECTION).doc(departmentName).get()
          .then(doc => {
            if (doc.exists) {
              // Document exists, add lecturer to lecturers array
              const currentData = doc.data() as any;
              const lecturers = currentData.lecturers || [];
              
              // Format lecturer data
              const newLecturer = {
                id: lecturerData.id,
                title: lecturerData.title,
                name: lecturerData.name,
                sex: lecturerData.sex || '',
                roomName: lecturerData.roomName || '',
                schedulable: lecturerData.schedulable || false,
                role: 'Lecturer',
                contact: lecturerData.contact || {},
                address: lecturerData.address || {},
                accessibility: lecturerData.accessibility || {
                  deafLoop: false,
                  wheelchairAccess: false
                },
                weeklyTarget: lecturerData.weeklyTarget || 0,
                totalTarget: lecturerData.totalTarget || 0,
                profile: lecturerData.profile || '',
                tags: lecturerData.tags || [],
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              // Check if lecturer already exists (by ID)
              const existingIndex = lecturers.findIndex((l: any) => l.id === lecturerData.id);
              if (existingIndex >= 0) {
                // Update existing lecturer
                lecturers[existingIndex] = newLecturer;
              } else {
                // Add new lecturer
                lecturers.push(newLecturer);
              }
              
              // Update the document
              return firestore.collection(this.STAFF_COLLECTION).doc(departmentName).update({
                lecturers: lecturers,
                updatedAt: new Date()
              });
            } else {
              // Document doesn't exist, create it with the lecturer
              const departmentData = {
                id: departmentName,
                title: '',
                name: '',
                sex: '',
                department: departmentName,
                roomName: '',
                schedulable: false,
                role: 'HOD',
                contact: {},
                address: {},
                accessibility: {
                  deafLoop: false,
                  wheelchairAccess: false
                },
                weeklyTarget: 0,
                totalTarget: 0,
                allowanceWeek: 0,
                allowanceTotal: 0,
                profile: '',
                tags: [],
                lecturers: [{
                  id: lecturerData.id,
                  title: lecturerData.title,
                  name: lecturerData.name,
                  sex: lecturerData.sex || '',
                  roomName: lecturerData.roomName || '',
                  schedulable: lecturerData.schedulable || false,
                  role: 'Lecturer',
                  contact: lecturerData.contact || {},
                  address: lecturerData.address || {},
                  accessibility: lecturerData.accessibility || {
                    deafLoop: false,
                    wheelchairAccess: false
                  },
                  weeklyTarget: lecturerData.weeklyTarget || 0,
                  totalTarget: lecturerData.totalTarget || 0,
                  profile: lecturerData.profile || '',
                  tags: lecturerData.tags || [],
                  createdAt: new Date(),
                  updatedAt: new Date()
                }],
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              return firestore.collection(this.STAFF_COLLECTION).doc(departmentName).set(departmentData);
            }
          })
          .then(() => {
            console.log('Lecturer added successfully!');
            resolve();
          })
          .catch(error => {
            console.error('Error adding lecturer:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      map(() => ({
        success: true,
        message: 'Lecturer added successfully'
      })),
      catchError(error => {
        console.error('Error in addLecturerToDepartment:', error);
        return of({
          success: false,
          message: `Failed to add lecturer: ${error.message}`
        });
      })
    );
  }
  
  // Add multiple lecturers to a department (bulk upload)
  addLecturersToDepartment(departmentName: string, lecturersData: User[]): Observable<{ success: boolean, message: string, addedCount: number, errors: string[] }> {
    console.log('Adding multiple lecturers to department:', departmentName, lecturersData.length);
    
    return from(new Promise<{ addedCount: number, errors: string[] }>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Get the department document
        firestore.collection(this.STAFF_COLLECTION).doc(departmentName).get()
          .then(doc => {
            const currentData = doc.exists ? doc.data() as any : {};
            const existingLecturers = currentData.lecturers || [];
            
            let addedCount = 0;
            const errors: string[] = [];
            
            // Process each lecturer
            lecturersData.forEach((lecturerData, index) => {
              try {
                // Validate required fields
                if (!lecturerData.id || !lecturerData.name || !lecturerData.contact?.email) {
                  errors.push(`Row ${index + 1}: Missing required fields (ID, Name, or Email)`);
                  return;
                }
                
                const newLecturer = {
                  id: lecturerData.id,
                  title: lecturerData.title || 'MR',
                  name: lecturerData.name,
                  sex: lecturerData.sex || '',
                  roomName: lecturerData.roomName || '',
                  schedulable: lecturerData.schedulable || false,
                  role: 'Lecturer',
                  contact: lecturerData.contact,
                  address: lecturerData.address || {},
                  accessibility: lecturerData.accessibility || {
                    deafLoop: false,
                    wheelchairAccess: false
                  },
                  weeklyTarget: lecturerData.weeklyTarget || 0,
                  totalTarget: lecturerData.totalTarget || 0,
                  profile: lecturerData.profile || '',
                  tags: lecturerData.tags || [],
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                // Check if lecturer already exists
                const existingIndex = existingLecturers.findIndex((l: any) => l.id === lecturerData.id);
                if (existingIndex >= 0) {
                  // Update existing lecturer
                  existingLecturers[existingIndex] = newLecturer;
                } else {
                  // Add new lecturer
                  existingLecturers.push(newLecturer);
                }
                
                addedCount++;
              } catch (error) {
                errors.push(`Row ${index + 1}: ${error}`);
              }
            });
            
            // Update the document with all lecturers
            const updateData = {
              ...currentData,
              lecturers: existingLecturers,
              updatedAt: new Date()
            };
            
            // If document doesn't exist, include basic department info
            if (!doc.exists) {
              updateData.id = departmentName;
              updateData.department = departmentName;
              updateData.role = 'HOD';
              updateData.createdAt = new Date();
            }
            
            return firestore.collection(this.STAFF_COLLECTION).doc(departmentName)
              .set(updateData, { merge: true })
              .then(() => {
                resolve({ addedCount, errors });
              });
          })
          .catch(error => {
            console.error('Error in bulk add:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      map((result) => ({
        success: true,
        message: `Successfully processed ${result.addedCount} lecturers${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`,
        addedCount: result.addedCount,
        errors: result.errors
      })),
      catchError(error => {
        console.error('Error in addLecturersToDepartment:', error);
        return of({
          success: false,
          message: `Failed to add lecturers: ${error.message}`,
          addedCount: 0,
          errors: [error.message]
        });
      })
    );
  }
  
  // Get all lecturers for a specific department
  getLecturersByDepartment(departmentName: string): Observable<User[]> {
    return from(new Promise<User[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.STAFF_COLLECTION).doc(departmentName).get()
          .then(doc => {
            if (doc.exists) {
              const data = doc.data() as any;
              const lecturers = data.lecturers || [];
              resolve(lecturers);
            } else {
              resolve([]);
            }
          })
          .catch(error => {
            console.error('Error fetching lecturers:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getLecturersByDepartment:', error);
        return of([]);
      })
    );
  }

  addModuleToDepartment(department: string, moduleData: Module): Observable<{ success: boolean; message: string }> {
    // Implement your logic here, e.g., call backend API or update local data
    // This is a stub for demonstration
    return of({
      success: true,
      message: `Module ${moduleData.code} added to department ${department}`
    });
  }

  getModulesByDepartment(department: string): Observable<Module[]> {
    // TODO: Replace with actual API call or data retrieval logic
    return of([]);
  }

  addModulesToDepartment(department: string, modules: Module[]): Observable<{ success: boolean; message: string; addedCount: number; errors: string[] }> {
    // Implement your logic here, e.g., call backend API or update local data
    // This is a stub for demonstration
    return of({
      success: true,
      message: `Added ${modules.length} modules to department ${department}`,
      addedCount: modules.length,
      errors: []
    });
  }
}

