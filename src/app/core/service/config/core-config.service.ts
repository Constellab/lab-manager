import {Injectable, LogLevel} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {EnvironmentProfile} from '../../model/config.class';

export const ENVIRONMENT_PROFILE_KEY = 'ENVIRONMENT_PROFILE';

@Injectable()
export class CoreConfigService {

  constructor(private configService: ConfigService) {
  }

  public getEnvironmentProfile(): EnvironmentProfile {
    return this.configService.get(ENVIRONMENT_PROFILE_KEY);
  }

  public isProduction(): boolean {
    return this.getEnvironmentProfile() === 'prod';
  }

  public isLocal(): boolean {
    const env: EnvironmentProfile = this.getEnvironmentProfile();
    return env === 'dev' || env === 'test';
  }

  public getLogLevel(): LogLevel {
    return this.configService.get('LOG_LEVEL') ?? 'log';
  }

  public getLogPath(): string {
    return this.configService.get('LOG_PATH');
  }

  public getLabManagerApiKey(): string {
    return this.configService.get('LAB_MANAGER_API_KEY');
  }

  public getCentralApiUrl(): string {
    if (this.getEnvironmentProfile() === 'prod') {
      return 'https://central-back.constellab.gencovery.com';
    } else {
      return 'https://central-back-pre-prod.constellab-pre-prod.gencovery.com';
    }
  }
}
