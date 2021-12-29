import { Test, TestingModule } from '@nestjs/testing';
import { BrickService } from './brick.service';

describe('BrickService', () => {
  let service: BrickService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrickService],
    }).compile();

    service = module.get<BrickService>(BrickService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
