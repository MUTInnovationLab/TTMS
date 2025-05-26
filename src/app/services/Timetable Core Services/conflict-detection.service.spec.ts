import { TestBed } from '@angular/core/testing';

import { ConflictDetectionService } from './conflict-detection.service';

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConflictDetectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
