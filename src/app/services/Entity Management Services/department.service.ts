import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from '@angular/fire/firestore';
import { collectionData, docData } from '@angular/fire/firestore';
import { Department } from '../../interfaces/department.interface';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private departmentsSubject = new BehaviorSubject<Department[]>([]);
  public departments$ = this.departmentsSubject.asObservable();
  
  private readonly collectionName = 'departments';

  constructor(private firestore: Firestore) {}

  // Get all departments
  getAllDepartments(): Observable<Department[]> {
    const departmentsCollection = collection(this.firestore, this.collectionName);
    const departmentsQuery = query(departmentsCollection, orderBy('name'));
    
    return collectionData(departmentsQuery, { idField: 'id' }).pipe(
      map(departments => departments.map(dept => ({
        ...dept,
        createdAt: (dept as any)['createdAt']?.toDate ? (dept as any)['createdAt'].toDate() : new Date((dept as any)['createdAt']),
        updatedAt: (dept as any)['updatedAt']?.toDate ? (dept as any)['updatedAt'].toDate() : new Date((dept as any)['updatedAt'])
      } as Department))),
      tap(departments => this.departmentsSubject.next(departments))
    );
  }

  // Get department by ID
  getDepartmentById(id: string): Observable<Department | null> {
    const departmentDoc = doc(this.firestore, this.collectionName, id);
    return docData(departmentDoc, { idField: 'id' }).pipe(
      map(dept => dept ? {
        ...dept,
        createdAt: (dept as any)['createdAt']?.toDate ? (dept as any)['createdAt'].toDate() : new Date((dept as any)['createdAt']),
        updatedAt: (dept as any)['updatedAt']?.toDate ? (dept as any)['updatedAt'].toDate() : new Date((dept as any)['updatedAt'])
      } as Department : null)
    );
  }

  // Add new department
  addDepartment(department: Department): Observable<{ success: boolean; message: string; id?: string }> {
    return new Observable(observer => {
      const departmentsCollection = collection(this.firestore, this.collectionName);
      
      // Check if department with same name or code already exists
      this.checkDepartmentExists(department.name, department.code).subscribe({
        next: (exists) => {
          if (exists.nameExists) {
            observer.next({ success: false, message: 'Department with this name already exists' });
            observer.complete();
            return;
          }
          
          if (exists.codeExists) {
            observer.next({ success: false, message: 'Department with this code already exists' });
            observer.complete();
            return;
          }

          // Add the department
          const departmentData = {
            ...department,
            createdAt: new Date(),
            updatedAt: new Date(),
            moduleCount: 0,
            lecturerCount: 0,
            studentCount: 0
          };

          addDoc(departmentsCollection, departmentData).then(docRef => {
            observer.next({ success: true, message: 'Department added successfully', id: docRef.id });
            observer.complete();
            
            // Refresh the departments list
            this.getAllDepartments().subscribe();
          }).catch(error => {
            console.error('Error adding department:', error);
            observer.next({ success: false, message: 'Failed to add department: ' + error.message });
            observer.complete();
          });
        },
        error: (error) => {
          console.error('Error checking department existence:', error);
          observer.next({ success: false, message: 'Failed to validate department: ' + error.message });
          observer.complete();
        }
      });
    });
  }

  // Update department
  updateDepartment(id: string, department: Partial<Department>): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      const departmentDoc = doc(this.firestore, this.collectionName, id);
      
      const updateData = {
        ...department,
        updatedAt: new Date()
      };

      updateDoc(departmentDoc, updateData).then(() => {
        observer.next({ success: true, message: 'Department updated successfully' });
        observer.complete();
        
        // Refresh the departments list
        this.getAllDepartments().subscribe();
      }).catch(error => {
        console.error('Error updating department:', error);
        observer.next({ success: false, message: 'Failed to update department: ' + error.message });
        observer.complete();
      });
    });
  }

  // Delete department
  deleteDepartment(id: string): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      const departmentDoc = doc(this.firestore, this.collectionName, id);
      
      deleteDoc(departmentDoc).then(() => {
        observer.next({ success: true, message: 'Department deleted successfully' });
        observer.complete();
        
        // Refresh the departments list
        this.getAllDepartments().subscribe();
      }).catch(error => {
        console.error('Error deleting department:', error);
        observer.next({ success: false, message: 'Failed to delete department: ' + error.message });
        observer.complete();
      });
    });
  }

  // Check if department exists by name or code
  private checkDepartmentExists(name: string, code: string): Observable<{ nameExists: boolean; codeExists: boolean }> {
    return new Observable(observer => {
      const departmentsCollection = collection(this.firestore, this.collectionName);
      
      Promise.all([
        getDocs(query(departmentsCollection, where('name', '==', name))),
        getDocs(query(departmentsCollection, where('code', '==', code.toUpperCase())))
      ]).then(([nameSnapshot, codeSnapshot]) => {
        observer.next({
          nameExists: !nameSnapshot.empty,
          codeExists: !codeSnapshot.empty
        });
        observer.complete();
      }).catch(error => {
        console.error('Error checking department existence:', error);
        observer.error(error);
      });
    });
  }

  // Get active departments only
  getActiveDepartments(): Observable<Department[]> {
    const departmentsCollection = collection(this.firestore, this.collectionName);
    const activeDepartmentsQuery = query(
      departmentsCollection, 
      where('status', '==', 'active'),
      orderBy('name')
    );
    
    return collectionData(activeDepartmentsQuery, { idField: 'id' }).pipe(
      map(departments => departments.map(dept => ({
        ...dept,
        createdAt: (dept as any)['createdAt']?.toDate ? (dept as any)['createdAt'].toDate() : new Date((dept as any)['createdAt']),
        updatedAt: (dept as any)['updatedAt']?.toDate ? (dept as any)['updatedAt'].toDate() : new Date((dept as any)['updatedAt'])
      } as Department)))
    );
  }

  // Update department statistics
  updateDepartmentStats(id: string, stats: { moduleCount?: number; lecturerCount?: number; studentCount?: number }): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      const departmentDoc = doc(this.firestore, this.collectionName, id);
      
      const updateData = {
        ...stats,
        updatedAt: new Date()
      };

      updateDoc(departmentDoc, updateData).then(() => {
        observer.next({ success: true, message: 'Department statistics updated successfully' });
        observer.complete();
      }).catch(error => {
        console.error('Error updating department statistics:', error);
        observer.next({ success: false, message: 'Failed to update department statistics: ' + error.message });
        observer.complete();
      });
    });
  }
}
