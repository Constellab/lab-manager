import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { AdminerComposeService } from './adminer/adminer-compose.service';
import { AdminerController } from './adminer/adminer.controller';
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import { DockerComposeService } from './compose/docker-compose.service';
import { MainComposeService } from './compose/main-compose.service';
import { DockerContainerService } from './container/docker-container.service';
import { DockerComposeController } from './docker-compose-controller';
import { DockerContainersController } from './docker-containers.controller';

/**
 * Module that contains services related to manager docker containers
 */
@Module({
  providers: [
    MainComposeService,
    DockerContainerService,
    AdminerComposeService,
    DockerComposeService,
    DockerComposeAggregateService,
  ],
  exports: [
    DockerContainerService,
    AdminerComposeService,
    DockerComposeService,
    DockerComposeAggregateService,
    MainComposeService,
  ],
  imports: [CoreModule],
  controllers: [DockerComposeController, DockerContainersController, AdminerController],
})
export class DockerModule {}
