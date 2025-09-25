import { Module } from '@nestjs/common';
import { AdminerService } from 'src/app/docker/container/adminer.service';
import { CoreModule } from '../core/core.module';
import { ContainerService } from './container/container.service';
import { DockerComposeFactory } from './docker-compose.factory';
import { MainComposeService } from './main-compose.service';

/**
 * Module that contains services related to manager docker containers
 */
@Module({
  providers: [MainComposeService, ContainerService, AdminerService, DockerComposeFactory],
  exports: [MainComposeService, ContainerService, AdminerService, DockerComposeFactory],
  imports: [CoreModule],
})
export class DockerModule {}
