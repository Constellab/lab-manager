import { Controller, Get } from '@nestjs/common';
import { Public } from './app/core/decorators/public.decorator';
import { ExternalSpaceApiService } from './app/core/services/external/external-space-api.service';
import { LabManagerRecommendedVersion } from './app/core/services/external/external-space.class';
import { ExternalLabApiService } from './app/core/services/external/external-lab-api.service';

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

  @Get('lab-manager-recommended-version')
  async getLabManagerRecommendedVersion(): Promise<LabManagerRecommendedVersion> {
    // TODO to implement
    return { labManagerRecommendedVersion: '1.14.0' };
    return this.spaceService.getLabManagerRecommendedVersion();
  }

  @Get('lab-is-running')
  async labIsRunning(): Promise<{ labIsRunning: boolean }> {
    return { labIsRunning: await this.externalLabService.healthCheck() };
  }
}
