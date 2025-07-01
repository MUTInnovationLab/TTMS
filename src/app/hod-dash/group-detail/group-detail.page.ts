import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { Group } from '../../models/group.model';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class GroupDetailPage implements OnInit {
  groupId: string | null = null;
  group: Group | null = null;

  constructor(
    private route: ActivatedRoute,
    private groupService: GroupService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id');
    if (this.groupId) {
      this.loadGroup(this.groupId);
    }
  }

  async loadGroup(id: string) {
    this.groupService.getGroups().subscribe(groups => {
      this.group = groups.find(g => g.id.toString() === id) || null;
    });
  }

  async saveGroup() {
    if (!this.group) return;

    try {
      await this.groupService.updateGroup(this.group);
      const toast = await this.toastCtrl.create({
        message: 'Group updated successfully',
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (error: any) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to update group: ' + error.message,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async deleteGroup() {
    if (!this.group || !this.group.id) return;

    try {
      await this.groupService.deleteGroup(this.group.id);
      const toast = await this.toastCtrl.create({
        message: 'Group deleted successfully',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      // Navigate back to hod-dash after deletion
      history.back();
    } catch (error: any) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to delete group: ' + error.message,
        buttons: ['OK']
      });
      await alert.present();
    }
  }
}
