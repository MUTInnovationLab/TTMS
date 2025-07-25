import { Injectable, NgZone } from '@angular/core';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { TimetableSession, Timetable } from './timetable.service';
import { AuthService } from '../Authentication Services/auth.service';

// Import Firebase directly for operations that cause DI issues
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface TimetableDocument {
  id: string;
  name: string;
  department: string;
  hodEmail: string;
  academicYear: string;
  semester: number;
  status: 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected';
  sessions: TimetableSession[];
  createdAt: any;
  updatedAt: any;
  submittedAt?: any;
  approvedAt?: any;
  rejectedAt?: any;
  adminFeedback?: string;
  conflictCount?: number;
  version?: number;
}

export interface TimetableSubmissionHistory {
  id: string;
  department: string;
  academicPeriod: string;
  submittedAt: any;
  status: string;
  conflictCount: number;
  hasAdminFeedback: boolean;
  adminFeedback?: string;
  timetableId: string;
  reviewedAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class TimetableDatabaseService {
  private readonly TIMETABLES_COLLECTION = 'timetables';
  private readonly SUBMISSIONS_COLLECTION = 'timetable_submissions';
  
  private currentTimetableSubject = new BehaviorSubject<TimetableDocument | null>(null);
  private submissionHistorySubject = new BehaviorSubject<TimetableSubmissionHistory[]>([]);
  
  currentTimetable$ = this.currentTimetableSubject.asObservable();
  submissionHistory$ = this.submissionHistorySubject.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private ngZone: NgZone,
    private authService: AuthService
  ) {
    console.log('TimetableDatabaseService initialized');
  }

  // Get current timetable for a department
  getCurrentTimetable(department: string): Observable<TimetableDocument | null> {
    console.log('Getting current timetable for department:', department);
    
    return from(new Promise<TimetableDocument | null>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Query for the current academic year's timetable for this department
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}-${currentYear + 1}`;
        
        // Simplified query that doesn't require composite index
        firestore.collection(this.TIMETABLES_COLLECTION)
          .where('department', '==', department)
          .where('academicYear', '==', academicYear)
          .get()
          .then(snapshot => {
            if (!snapshot.empty) {
              // Filter and sort on client side to avoid index requirements
              const docs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as TimetableDocument))
                .filter(timetable => timetable.status === 'draft' || timetable.status === 'submitted' || 
                                   timetable.status === 'pending' || timetable.status === 'approved' || 
                                   timetable.status === 'rejected')
                .sort((a, b) => {
                  const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
                  const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
                  return bDate.getTime() - aDate.getTime();
                });
              
              if (docs.length > 0) {
                const timetable = docs[0];
                console.log('Current timetable found:', timetable);
                this.currentTimetableSubject.next(timetable);
                resolve(timetable);
              } else {
                console.log('No current timetable found for department:', department);
                resolve(null);
              }
            } else {
              console.log('No current timetable found for department:', department);
              resolve(null);
            }
          })
          .catch(error => {
            console.error('Error getting current timetable:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getCurrentTimetable:', error);
        return of(null);
      })
    );
  }

  // Create a new timetable
  createNewTimetable(
    department: string,
    name: string,
    academicYear: string,
    semester: number
  ): Observable<{ success: boolean; message: string; timetableId?: string }> {
    console.log('Creating new timetable for department:', department);
    
    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser) {
      return of({
        success: false,
        message: 'No authenticated user found'
      });
    }

    const timetableData: Omit<TimetableDocument, 'id'> = {
      name,
      department,
      hodEmail: currentUser.email || '',
      academicYear,
      semester,
      status: 'draft',
      sessions: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: 1
    };

    return from(new Promise<{ success: boolean; message: string; timetableId?: string }>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.TIMETABLES_COLLECTION)
          .add(timetableData)
          .then(docRef => {
            console.log('Timetable created with ID:', docRef.id);
            
            const newTimetable: TimetableDocument = {
              id: docRef.id,
              ...timetableData,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            this.currentTimetableSubject.next(newTimetable);
            
            resolve({
              success: true,
              message: 'Timetable created successfully',
              timetableId: docRef.id
            });
          })
          .catch(error => {
            console.error('Error creating timetable:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in createNewTimetable:', error);
        return of({
          success: false,
          message: `Failed to create timetable: ${error.message}`
        });
      })
    );
  }

  // Helper function to remove undefined values from objects
  private cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Save timetable (update existing or create new)
  saveTimetable(timetableData: Partial<TimetableDocument>, timetableId?: string): Observable<{ success: boolean; message: string; timetableId?: string }> {
    console.log('Saving timetable:', timetableId ? 'Update existing' : 'Create new');
    
    const cleanedData = this.cleanUndefinedValues(timetableData);
    const updateData = {
      ...cleanedData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return from(new Promise<{ success: boolean; message: string; timetableId?: string }>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        if (timetableId) {
          // Update existing timetable
          firestore.collection(this.TIMETABLES_COLLECTION)
            .doc(timetableId)
            .update(updateData)
            .then(() => {
              console.log('Timetable updated successfully:', timetableId);
              resolve({
                success: true,
                message: 'Timetable saved successfully',
                timetableId
              });
            })
            .catch(error => {
              console.error('Error updating timetable:', error);
              reject(error);
            });
        } else {
          // Create new timetable
          firestore.collection(this.TIMETABLES_COLLECTION)
            .add({
              ...updateData,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then(docRef => {
              console.log('New timetable created:', docRef.id);
              resolve({
                success: true,
                message: 'Timetable created successfully',
                timetableId: docRef.id
              });
            })
            .catch(error => {
              console.error('Error creating timetable:', error);
              reject(error);
            });
        }
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in saveTimetable:', error);
        return of({
          success: false,
          message: `Failed to save timetable: ${error.message}`
        });
      })
    );
  }

  // Add or update a session in a timetable
  addOrUpdateSession(timetableId: string, session: TimetableSession): Observable<{ success: boolean; message: string }> {
    console.log('Adding/updating session in timetable:', timetableId);
    
    return this.getTimetableById(timetableId).pipe(
      switchMap(timetable => {
        if (!timetable) {
          return of({
            success: false,
            message: 'Timetable not found'
          });
        }

        // Update or add the session
        const sessions = [...timetable.sessions];
        const existingIndex = sessions.findIndex(s => s.id === session.id);
        
        if (existingIndex >= 0) {
          // Update existing session
          sessions[existingIndex] = session;
        } else {
          // Add new session
          sessions.push(session);
        }

        // Save the updated timetable
        return this.saveTimetable({ sessions }, timetableId);
      })
    );
  }

  // Remove a session from a timetable
  removeSession(timetableId: string, sessionId: number): Observable<{ success: boolean; message: string }> {
    console.log('Removing session from timetable:', timetableId, sessionId);
    
    return this.getTimetableById(timetableId).pipe(
      switchMap(timetable => {
        if (!timetable) {
          return of({
            success: false,
            message: 'Timetable not found'
          });
        }

        // Remove the session
        const sessions = timetable.sessions.filter(s => s.id !== sessionId);

        // Save the updated timetable
        return this.saveTimetable({ sessions }, timetableId);
      })
    );
  }

  // Submit timetable for approval
  submitTimetable(timetableId: string): Observable<{ success: boolean; message: string; submissionId?: string }> {
    console.log('Submitting timetable for approval:', timetableId);
    
    return this.getTimetableById(timetableId).pipe(
      switchMap(timetable => {
        if (!timetable) {
          return of({
            success: false,
            message: 'Timetable not found'
          });
        }

        // Create submission history record first
        const submissionData: Omit<TimetableSubmissionHistory, 'id'> = {
          department: timetable.department,
          academicPeriod: `${timetable.academicYear}, Semester ${timetable.semester}`,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'submitted',
          conflictCount: timetable.conflictCount || 0,
          hasAdminFeedback: false,
          timetableId: timetableId
        };

        return from(new Promise<{ success: boolean; message: string; submissionId?: string }>((resolve, reject) => {
          try {
            const firebaseApp = firebase.app();
            const firestore = firebaseApp.firestore();
            
            // Create submission history first
            firestore.collection(this.SUBMISSIONS_COLLECTION)
              .add(submissionData)
              .then(submissionDocRef => {
                console.log('Submission history created:', submissionDocRef.id);
                
                // Then update timetable status
                return firestore.collection(this.TIMETABLES_COLLECTION)
                  .doc(timetableId)
                  .update({
                    status: 'submitted',
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
              })
              .then(() => {
                // Reload submission history
                this.loadSubmissionHistory(timetable.department).subscribe();
                
                resolve({
                  success: true,
                  message: 'Timetable submitted successfully'
                });
              })
              .catch(error => {
                console.error('Error in submission process:', error);
                reject(error);
              });
          } catch (error) {
            console.error('Error accessing Firebase:', error);
            reject(error);
          }
        }));
      }),
      catchError(error => {
        console.error('Error in submitTimetable:', error);
        return of({
          success: false,
          message: `Failed to submit timetable: ${error.message}`
        });
      })
    );
  }

  // Get timetable by ID
  getTimetableById(timetableId: string): Observable<TimetableDocument | null> {
    console.log('Getting timetable by ID:', timetableId);
    
    return from(new Promise<TimetableDocument | null>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.TIMETABLES_COLLECTION)
          .doc(timetableId)
          .get()
          .then(doc => {
            if (doc.exists) {
              const timetable = { id: doc.id, ...doc.data() } as TimetableDocument;
              resolve(timetable);
            } else {
              resolve(null);
            }
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error getting timetable by ID:', error);
        return of(null);
      })
    );
  }

  // Load submission history for a department
  loadSubmissionHistory(department: string): Observable<TimetableSubmissionHistory[]> {
    console.log('Loading submission history for department:', department);
    
    return from(new Promise<TimetableSubmissionHistory[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.SUBMISSIONS_COLLECTION)
          .where('department', '==', department)
          .get()
          .then(snapshot => {
            const submissions: TimetableSubmissionHistory[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              submissions.push({ 
                id: doc.id, 
                ...data,
                timetableId: data['timetableId'] // Ensure timetableId is included
              } as TimetableSubmissionHistory);
            });
            
            // Sort by submittedAt in JavaScript instead of Firestore to avoid index requirement
            submissions.sort((a, b) => {
              const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
              const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt || 0);
              return dateB.getTime() - dateA.getTime(); // desc order
            });
            
            console.log('Submission history loaded:', submissions.length, 'submissions');
            this.submissionHistorySubject.next(submissions);
            resolve(submissions);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error loading submission history:', error);
        return of([]);
      })
    );
  }

  // Get all timetables for admin view
  getAllTimetables(): Observable<TimetableDocument[]> {
    console.log('Getting all timetables');
    
    return from(new Promise<TimetableDocument[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection(this.TIMETABLES_COLLECTION)
          .get()
          .then(snapshot => {
            const timetables: TimetableDocument[] = [];
            snapshot.forEach(doc => {
              timetables.push({ id: doc.id, ...doc.data() } as TimetableDocument);
            });
            
            // Sort by createdAt in descending order (client-side)
            timetables.sort((a, b) => {
              const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
              const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
              return bDate.getTime() - aDate.getTime();
            });
            
            console.log('All timetables loaded:', timetables.length);
            resolve(timetables);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error getting all timetables:', error);
        return of([]);
      })
    );
  }

  // Approve timetable (admin function)
  approveTimetable(timetableId: string, adminFeedback?: string): Observable<{ success: boolean; message: string }> {
    console.log('Approving timetable:', timetableId);
    
    return from(new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // First update the timetable document
        firestore.collection(this.TIMETABLES_COLLECTION)
          .doc(timetableId)
          .update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            adminFeedback: adminFeedback || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          })
          .then(() => {
            console.log('Timetable approved, now updating submission history');
            
            // Then find and update the corresponding submission
            return firestore.collection(this.SUBMISSIONS_COLLECTION)
              .where('timetableId', '==', timetableId)
              .get();
          })
          .then(snapshot => {
            const updatePromises: Promise<void>[] = [];
            
            snapshot.forEach(doc => {
              updatePromises.push(
                firestore.collection(this.SUBMISSIONS_COLLECTION)
                  .doc(doc.id)
                  .update({
                    status: 'approved',
                    hasAdminFeedback: !!adminFeedback,
                    adminFeedback: adminFeedback || '',
                    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
                  })
              );
            });
            
            return Promise.all(updatePromises);
          })
          .then(() => {
            console.log('Timetable and submission history approved successfully');
            resolve({
              success: true,
              message: 'Timetable approved successfully'
            });
          })
          .catch(error => {
            console.error('Error approving timetable:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in approveTimetable:', error);
        return of({
          success: false,
          message: `Failed to approve timetable: ${error.message}`
        });
      })
    );
  }

  // Reject timetable (admin function)
  rejectTimetable(timetableId: string, adminFeedback: string): Observable<{ success: boolean; message: string }> {
    console.log('Rejecting timetable:', timetableId);
    
    return from(new Promise<{ success: boolean; message: string }>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // First update the timetable document
        firestore.collection(this.TIMETABLES_COLLECTION)
          .doc(timetableId)
          .update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            adminFeedback: adminFeedback,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          })
          .then(() => {
            console.log('Timetable rejected, now updating submission history');
            
            // Then find and update the corresponding submission
            return firestore.collection(this.SUBMISSIONS_COLLECTION)
              .where('timetableId', '==', timetableId)
              .get();
          })
          .then(snapshot => {
            const updatePromises: Promise<void>[] = [];
            
            snapshot.forEach(doc => {
              updatePromises.push(
                firestore.collection(this.SUBMISSIONS_COLLECTION)
                  .doc(doc.id)
                  .update({
                    status: 'rejected',
                    hasAdminFeedback: true,
                    adminFeedback: adminFeedback,
                    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
                  })
              );
            });
            
            return Promise.all(updatePromises);
          })
          .then(() => {
            console.log('Timetable and submission history rejected successfully');
            resolve({
              success: true,
              message: 'Timetable rejected successfully'
            });
          })
          .catch(error => {
            console.error('Error rejecting timetable:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in rejectTimetable:', error);
        return of({
          success: false,
          message: `Failed to reject timetable: ${error.message}`
        });
      })
    );
  }

  // Auto-save functionality
  autoSaveTimetable(timetableData: Partial<TimetableDocument>, timetableId?: string): Observable<{ success: boolean; message: string }> {
    console.log('Auto-saving timetable');
    
    // Add a flag to indicate this is an auto-save
    const autoSaveData = {
      ...timetableData,
      lastAutoSave: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return this.saveTimetable(autoSaveData, timetableId);
  }
}
