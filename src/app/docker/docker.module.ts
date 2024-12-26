import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { DockerService } from './docker.service';
import { ContainerService } from './container/container.service';
import { DockerCommandService } from './docker-command/docker-command.service';

/**
 * Module that contains services related to manager docker containers
 */
@Module({
  providers: [DockerService, ContainerService, DockerCommandService],
  exports: [DockerService, ContainerService, DockerCommandService],
  imports: [CoreModule],
})
export class DockerModule {}
