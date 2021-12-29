import { Module } from '@nestjs/common';
import { DockerCommandService } from './docker-command/docker-command.service';
import { DockerController } from './docker.controller';
import { DockerService } from './docker/docker.service';

@Module({
  providers: [DockerCommandService, DockerService],
  controllers: [DockerController]
})
export class DockerModule {}
