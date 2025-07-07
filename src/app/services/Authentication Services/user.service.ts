import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface DepartmentInfo {
  id: string;
  name: string;
  hodName: string;
  email: string;
  phone: string;
  location: string;
  budget?: number;
  establishedYear?: number;
}

export interface DepartmentStats {
  lecturers: number;
  groups: number;
  modules: number;
  sessions: number;
  students: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor() { }

  // Get department information by department name
  getDepartmentInfo(departmentName: string): Observable<DepartmentInfo | null> {
    return from(new Promise<DepartmentInfo | null>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Get the department document from the staff collection
        firestore.collection('staff').doc(departmentName).get()
          .then(doc => {
            if (doc.exists) {
              const data = doc.data() as any;
              
              const departmentInfo: DepartmentInfo = {
                id: doc.id,
                name: departmentName,
                hodName: data.name || 'Unknown HOD',
                email: data.contact?.email || '',
                phone: data.contact?.phone || '',
                location: data.location || 'Location not specified',
                budget: data.budget || 0,
                establishedYear: data.establishedYear || new Date().getFullYear()
              };
              
              resolve(departmentInfo);
            } else {
              console.warn(`Department ${departmentName} not found in staff collection`);
              resolve(null);
            }
          })
          .catch(error => {
            console.error('Error fetching department info:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getDepartmentInfo:', error);
        return of(null);
      })
    );
  }

  // Calculate department statistics
  getDepartmentStats(departmentName: string): Observable<DepartmentStats> {
    return from(new Promise<DepartmentStats>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        // Get the department document
        firestore.collection('staff').doc(departmentName).get()
          .then(doc => {
            if (doc.exists) {
              const data = doc.data() as any;
              
              // Calculate statistics from the department data
              const lecturerCount = Array.isArray(data.lecturers) ? data.lecturers.length : 0;
              const groupCount = Array.isArray(data.groups) ? data.groups.length : 0;
              const moduleCount = Array.isArray(data.modules) ? data.modules.length : 0;
              
              // Calculate total students from groups
              let totalStudents = 0;
              if (Array.isArray(data.groups)) {
                totalStudents = data.groups.reduce((sum: number, group: any) => {
                  return sum + (group.studentCount || group.size || 0);
                }, 0);
              }
              
              // Calculate sessions from timetable if available
              let sessionCount = 0;
              if (data.timetable && Array.isArray(data.timetable.sessions)) {
                sessionCount = data.timetable.sessions.length;
              }
              
              const stats: DepartmentStats = {
                lecturers: lecturerCount,
                groups: groupCount,
                modules: moduleCount,
                sessions: sessionCount,
                students: totalStudents
              };
              
              resolve(stats);
            } else {
              // Return default stats if department not found
              resolve({
                lecturers: 0,
                groups: 0,
                modules: 0,
                sessions: 0,
                students: 0
              });
            }
          })
          .catch(error => {
            console.error('Error fetching department stats:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getDepartmentStats:', error);
        return of({
          lecturers: 0,
          groups: 0,
          modules: 0,
          sessions: 0,
          students: 0
        });
      })
    );
  }

  // Get all departments (for admin use)
  getAllDepartments(): Observable<DepartmentInfo[]> {
    return from(new Promise<DepartmentInfo[]>((resolve, reject) => {
      try {
        const firebaseApp = firebase.app();
        const firestore = firebaseApp.firestore();
        
        firestore.collection('staff').get()
          .then(querySnapshot => {
            const departments: DepartmentInfo[] = [];
            
            querySnapshot.forEach(doc => {
              const data = doc.data() as any;
              
              // Only include documents that represent departments (have role: 'HOD')
              if (data.role === 'HOD') {
                const departmentInfo: DepartmentInfo = {
                  id: doc.id,
                  name: doc.id, // Document ID is the department name
                  hodName: data.name || 'Unknown HOD',
                  email: data.contact?.email || '',
                  phone: data.contact?.phone || '',
                  location: data.location || 'Location not specified',
                  budget: data.budget || 0,
                  establishedYear: data.establishedYear || new Date().getFullYear()
                };
                
                departments.push(departmentInfo);
              }
            });
            
            resolve(departments);
          })
          .catch(error => {
            console.error('Error fetching all departments:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error accessing Firebase:', error);
        reject(error);
      }
    })).pipe(
      catchError(error => {
        console.error('Error in getAllDepartments:', error);
        return of([]);
      })
    );
  }
}
