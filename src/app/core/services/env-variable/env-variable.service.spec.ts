import { Test, TestingModule } from '@nestjs/testing';
import { EnvVariableService } from './env-variable.service';

describe('EnvVariableService', () => {
  let service: EnvVariableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvVariableService],
    }).compile();

    service = module.get<EnvVariableService>(EnvVariableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
