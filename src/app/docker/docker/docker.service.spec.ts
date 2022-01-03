import {Test, TestingModule} from '@nestjs/testing';
import {DockerService} from './docker.service';
import {DockerCommandService} from '../docker-command/docker-command.service';
import {DockerCommandMock} from '../docker-command/docker-command.mock';

describe('DockerService', () => {
  let service: DockerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DockerService, DockerCommandService],
    })
      .overrideProvider(DockerCommandService).useClass(DockerCommandMock)
      .compile();

    service = module.get<DockerService>(DockerService);
  });

  it('should be defined', async () => {
    await service.listContainers();
  });
});
