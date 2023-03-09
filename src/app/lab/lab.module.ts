import {Module} from '@nestjs/common';
import {LabController} from './lab.controller';
import {DockerService} from './docker/docker.service';
import {ContainerService} from './container/container.service';
import {InitService} from './init/init.service';
import {LabService} from './lab.service';
import {ConfigFileService} from './config-file/config-file.service';
import {BiotaService} from './biota/biota.service';
import {EnvVariableService} from './env-variable/env-variable.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  providers: [
    DockerService,
    ContainerService,
    InitService,
    LabService,
    ConfigFileService,
    BiotaService,
    EnvVariableService,
  ],
  controllers: [LabController],
  imports: [HttpModule],
})
export class LabModule {
}
