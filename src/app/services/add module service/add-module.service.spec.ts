import { TestBed } from '@angular/core/testing';

import { AddModuleService } from './add-module.service';

describe('AddModuleService', () => {
  let service: AddModuleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AddModuleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
