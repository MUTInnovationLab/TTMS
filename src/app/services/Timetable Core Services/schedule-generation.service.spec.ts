import { TestBed } from '@angular/core/testing';

import { ScheduleGenerationService } from './schedule-generation.service';

describe('ScheduleGenerationService', () => {
  let service: ScheduleGenerationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScheduleGenerationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
