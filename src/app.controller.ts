import { Controller, Get } from '@nestjs/common';
import { Public } from './app/core/decorators/public.decorator';
import { ExternalLabApiService } from './app/core/services/external/external-lab-api.service';
import { ExternalSpaceApiService } from './app/core/services/external/external-space-api.service';
import { LabManagerMigrationPlanDTO } from './app/lab/init/migration/migration.dto';

@Controller()
export class AppController {
  constructor(
    private spaceService: ExternalSpaceApiService,
    private externalLabService: ExternalLabApiService
  ) {}

  @Public()
  @Get('health-check')
  healthCheck(): boolean {
    return true;
  }

  @Get('version-upgrade-info')
  async getVersionUpgradeInfo(): Promise<LabManagerMigrationPlanDTO> {
    return this.spaceService.getVersionUpgradeInfo();
  }

  @Get('lab-is-running')
  async labIsRunning(): Promise<{ labIsRunning: boolean }> {
    return { labIsRunning: await this.externalLabService.healthCheck() };
  }
}
