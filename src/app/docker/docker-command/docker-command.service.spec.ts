import { Test, TestingModule } from '@nestjs/testing';
import { DockerCommandService } from './docker-command.service';

describe('DockerCommandService', () => {
  let service: DockerCommandService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DockerCommandService],
    }).compile();

    service = module.get<DockerCommandService>(DockerCommandService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
