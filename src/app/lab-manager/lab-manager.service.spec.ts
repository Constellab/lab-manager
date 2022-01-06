import { Test, TestingModule } from '@nestjs/testing';
import { LabManagerService } from './lab-manager.service';

describe('LabManagerService', () => {
  let service: LabManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LabManagerService],
    }).compile();

    service = module.get<LabManagerService>(LabManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
