import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { AdminerComposeService } from './adminer/adminer-compose.service';
import { DockerComposeService } from './compose/docker-compose.service';
import { MainComposeService } from './compose/main-compose.service';
import { DockerContainerService } from './container/docker-container.service';
import { DockerController } from './docker.controller';

/**
 * Module that contains services related to manager docker containers
 */
@Module({
  providers: [MainComposeService, DockerContainerService, AdminerComposeService, DockerComposeService],
  exports: [MainComposeService, DockerContainerService, AdminerComposeService, DockerComposeService],
  imports: [CoreModule],
  controllers: [DockerController],
})
export class DockerModule {}
