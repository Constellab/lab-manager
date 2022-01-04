import { Test, TestingModule } from '@nestjs/testing';
import { BiotaService } from './biota.service';

describe('BiotaService', () => {
  let service: BiotaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BiotaService],
    }).compile();

    service = module.get<BiotaService>(BiotaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
