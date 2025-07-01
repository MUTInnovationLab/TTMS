import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Group } from '../models/group.model';
import { Firestore, collectionData, collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class GroupService {

  private groupsCollection;

  constructor(private firestore: Firestore) {
    this.groupsCollection = collection(this.firestore, 'groups');
  }

  getGroups(): Observable<Group[]> {
    return collectionData(this.groupsCollection, { idField: 'id' }) as Observable<Group[]>;
  }

  async addGroup(group: Group): Promise<void> {
    const newGroup = {
      ...group,
      createdAt: serverTimestamp()
    };
    await addDoc(this.groupsCollection, newGroup);
  }

  async updateGroup(group: Group): Promise<void> {
    if (!group.id) {
      throw new Error('Group id is required for update');
    }
    const groupDocRef = doc(this.firestore, `groups/${group.id}`);
    await updateDoc(groupDocRef, {
      name: group.name,
      program: group.program,
      year: group.year,
      size: group.size,
      groupType: group.groupType
    });
  }

  async deleteGroup(groupId: number): Promise<void> {
    const groupDocRef = doc(this.firestore, `groups/${groupId}`);
    await deleteDoc(groupDocRef);
  }
}
