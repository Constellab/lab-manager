import { Module } from '@nestjs/common';
import { DockerCommandService } from './docker-command/docker-command.service';
import { DockerController } from './docker.controller';
import { DockerService } from './docker/docker.service';
import { ContainerService } from './container/container.service';

@Module({
  providers: [DockerCommandService, DockerService, ContainerService],
  controllers: [DockerController]
})
export class DockerModule {}
