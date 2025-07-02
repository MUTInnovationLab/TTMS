import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
@Component({
  selector: 'app-add-venue',
  templateUrl: './add-venue.component.html',
  styleUrls: ['./add-venue.component.scss'],
  standalone: false,
})
export class AddVenueComponent  implements OnInit {
    venueForm!: FormGroup;

  constructor(    private formBuilder: FormBuilder,
    private modalController: ModalController) { }

  ngOnInit() {}

}
