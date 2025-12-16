import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { DockerModule } from '../docker/docker.module';
import { CommunityController } from './community.controller';
import { EnvVariableService } from './env-variable/env-variable.service';
import { InitService } from './init/init.service';
import { MigrationService } from './init/migration/migration.service';
import { LabDesktopComposeService } from './lab-desktop-compose.service';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';

@Module({
  providers: [InitService, LabService, LabDesktopComposeService, EnvVariableService, MigrationService],
  controllers: [LabController, CommunityController],
  imports: [HttpModule, CoreModule, DockerModule],
})
export class LabModule {}
