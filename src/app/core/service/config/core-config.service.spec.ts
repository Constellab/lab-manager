import { Test, TestingModule } from '@nestjs/testing';
import { CoreConfigService } from './core-config.service';

describe('ConfigService', () => {
  let service: CoreConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoreConfigService],
    }).compile();

    service = module.get<CoreConfigService>(CoreConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
