import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDashPage } from './admin-dash.page';

describe('AdminDashPage', () => {
  let component: AdminDashPage;
  let fixture: ComponentFixture<AdminDashPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminDashPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
