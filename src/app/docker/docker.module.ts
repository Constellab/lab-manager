import {Module} from '@nestjs/common';
import {DockerController} from './docker.controller';
import {DockerService} from './docker/docker.service';
import {ContainerService} from './container/container.service';
import {InitService} from './init/init.service';

@Module({
  providers: [DockerService, ContainerService, InitService],
  controllers: [DockerController]
})
export class DockerModule {
}
