import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { InitService } from './init/init.service';
import { LabService } from './lab.service';
import { BiotaService } from './biota/biota.service';
import { EnvVariableService } from './env-variable/env-variable.service';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '../core/core.module';
import { DockerModule } from '../docker/docker.module';
import { LabDesktopService } from './lab-desktop.service';
import { CommunityController } from './community.controller';

@Module({
  providers: [InitService, LabService, LabDesktopService, BiotaService, EnvVariableService],
  controllers: [LabController, CommunityController],
  imports: [HttpModule, CoreModule, DockerModule],
})
export class LabModule {}
