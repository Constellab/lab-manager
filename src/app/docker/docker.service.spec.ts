import { Test, TestingModule } from '@nestjs/testing';
import { DockerCommandMock } from '../../core/services/docker-command/docker-command.mock';
import { DockerCommandService } from '../../core/services/docker-command/docker-command.service';
import { MainComposeService } from './main-compose.service';

describe('DockerService', () => {
  let service: MainComposeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MainComposeService, DockerCommandService],
    })
      .overrideProvider(DockerCommandService)
      .useClass(DockerCommandMock)
      .compile();

    service = module.get<MainComposeService>(MainComposeService);
  });

  it('should be defined', async () => {
    await service.inspectContainers();
  });
});
