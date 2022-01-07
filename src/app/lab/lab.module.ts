import {Module} from '@nestjs/common';
import {LabController} from './lab.controller';
import {DockerService} from './docker/docker.service';
import {ContainerService} from './container/container.service';
import {InitService} from './init/init.service';
import {LabService} from './lab.service';

@Module({
  providers: [
    DockerService,
    ContainerService,
    InitService,
    LabService,
  ],
  controllers: [LabController]
})
export class LabModule {
}
