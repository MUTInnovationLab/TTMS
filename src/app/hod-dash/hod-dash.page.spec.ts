import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HodDashPage } from './hod-dash.page';

describe('HodDashPage', () => {
  let component: HodDashPage;
  let fixture: ComponentFixture<HodDashPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HodDashPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
