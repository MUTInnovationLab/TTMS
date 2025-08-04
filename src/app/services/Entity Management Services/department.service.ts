import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, combineLatest, of } from 'rxjs';
import { map, tap, switchMap, catchError } from 'rxjs/operators';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Department } from '../../interfaces/department.interface';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private departmentsSubject = new BehaviorSubject<Department[]>([]);
  public departments$ = this.departmentsSubject.asObservable();
  
  private readonly collectionName = 'departments';
  private departmentsCollection: AngularFirestoreCollection<Department>;

  constructor(private afs: AngularFirestore) {
    this.departmentsCollection = this.afs.collection<Department>(this.collectionName);
  }

  // Get all departments
  getAllDepartments(): Observable<Department[]> {
    return from(this.departmentsCollection.ref.orderBy('name').get().then(snapshot => {
      const departments = snapshot.docs.map(doc => {
        const data = doc.data() as Department;
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt ? (data.createdAt as any).toDate ? (data.createdAt as any).toDate() : new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? (data.updatedAt as any).toDate ? (data.updatedAt as any).toDate() : new Date(data.updatedAt) : new Date()
        };
      });
      this.departmentsSubject.next(departments);
      return departments;
    }));
  }

  // Get department by ID
  getDepartmentById(id: string): Observable<Department | null> {
    const departmentDoc: AngularFirestoreDocument<Department> = this.departmentsCollection.doc(id);
    return departmentDoc.valueChanges().pipe(
      map(dept => dept ? {
        ...dept,
        id,
        createdAt: dept.createdAt ? (dept.createdAt as any).toDate ? (dept.createdAt as any).toDate() : new Date(dept.createdAt) : new Date(),
        updatedAt: dept.updatedAt ? (dept.updatedAt as any).toDate ? (dept.updatedAt as any).toDate() : new Date(dept.updatedAt) : new Date()
      } : null)
    );
  }

  // Add new department
  addDepartment(department: Department): Observable<{ success: boolean; message: string; id?: string }> {
    return this.checkDepartmentExists(department.name, department.code).pipe(
      switchMap(exists => {
        if (exists.nameExists) {
          return of({ success: false, message: 'Department with this name already exists' });
        }
        if (exists.codeExists) {
          return of({ success: false, message: 'Department with this code already exists' });
        }
        const departmentData = {
          ...department,
          createdAt: new Date(),
          updatedAt: new Date(),
          moduleCount: 0,
          lecturerCount: 0,
          studentCount: 0
        };
        return from(this.departmentsCollection.add(departmentData)).pipe(
          map(docRef => {
            this.getAllDepartments();
            return { success: true, message: 'Department added successfully', id: docRef.id };
          }),
          catchError(error => {
            console.error('Error adding department:', error);
            return of({ success: false, message: 'Failed to add department: ' + error.message });
          })
        );
      }),
      catchError(error => {
        console.error('Error checking department existence:', error);
        return of({ success: false, message: 'Failed to validate department: ' + error.message });
      })
    );
  }

  // Update department
  updateDepartment(id: string, department: Partial<Department>): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      const departmentDoc: AngularFirestoreDocument<Department> = this.departmentsCollection.doc(id);
      const updateData = {
        ...department,
        updatedAt: new Date()
      };

      departmentDoc.update(updateData).then(() => {
        observer.next({ success: true, message: 'Department updated successfully' });
        observer.complete();
        this.getAllDepartments();
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
      const departmentDoc: AngularFirestoreDocument<Department> = this.departmentsCollection.doc(id);
      departmentDoc.delete().then(() => {
        observer.next({ success: true, message: 'Department deleted successfully' });
        observer.complete();
        this.getAllDepartments();
      }).catch(error => {
        console.error('Error deleting department:', error);
        observer.next({ success: false, message: 'Failed to delete department: ' + error.message });
        observer.complete();
      });
    });
  }

  // Check if department exists by name or code
  private checkDepartmentExists(name: string, code: string): Observable<{ nameExists: boolean; codeExists: boolean }> {
    const nameQuery$ = this.departmentsCollection.ref.where('name', '==', name).get().then(snapshot => snapshot.docs.length > 0);
    const codeQuery$ = this.departmentsCollection.ref.where('code', '==', code.toUpperCase()).get().then(snapshot => snapshot.docs.length > 0);

    return from(Promise.all([nameQuery$, codeQuery$])).pipe(
      map(([nameExists, codeExists]) => ({
        nameExists,
        codeExists
      }))
    );
  }

  // Get active departments only
  getActiveDepartments(): Observable<Department[]> {
    return this.afs.collection<Department>(this.collectionName, ref => ref.where('status', '==', 'active').orderBy('name')).valueChanges({ idField: 'id' }).pipe(
      map(departments => departments.map(dept => ({
        ...dept,
        createdAt: dept.createdAt ? (dept.createdAt as any).toDate ? (dept.createdAt as any).toDate() : new Date(dept.createdAt) : new Date(),
        updatedAt: dept.updatedAt ? (dept.updatedAt as any).toDate ? (dept.updatedAt as any).toDate() : new Date(dept.updatedAt) : new Date()
      } as Department)))
    );
  }

  // Update department statistics
  updateDepartmentStats(id: string, stats: { moduleCount?: number; lecturerCount?: number; studentCount?: number }): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      const departmentDoc: AngularFirestoreDocument<Department> = this.departmentsCollection.doc(id);
      const updateData = {
        ...stats,
        updatedAt: new Date()
      };

      departmentDoc.update(updateData).then(() => {
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
