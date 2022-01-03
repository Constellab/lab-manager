import {Module} from '@nestjs/common';
import {DockerController} from './docker.controller';
import {DockerService} from './docker/docker.service';
import {ContainerService} from './container/container.service';

@Module({
  providers: [DockerService, ContainerService],
  controllers: [DockerController]
})
export class DockerModule {
}
