import {Injectable, LogLevel} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {EnvironmentProfile} from '../../models/config.class';
import {join} from 'path';

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

  public getVirtualHost(): string {
    return this.configService.get('VIRTUAL_HOST');
  }


  public getCentralApiUrl(): string {
    if (this.getEnvironmentProfile() === 'prod') {
      return 'https://central-back.constellab.gencovery.com';
    } else {
      return 'https://central-back-pre-prod.constellab-pre-prod.gencovery.com';
    }
  }

  public getCentralFrontUrl(): string {
    if (this.getEnvironmentProfile() === 'prod') {
      return 'https://constellab.gencovery.com';
    } else {
      return 'https://constellab-pre-prod.gencovery.com';
    }
  }

  public getHubFrontUrl(): string {
    if (this.getEnvironmentProfile() === 'prod') {
      return 'https://hub.gencovery.com';
    } else {
      return 'https://hub-pre-prod.gencovery.com';
    }
  }

  public getDockerRegistryUrl(): string {
    return this.configService.get('DOCKER_REGISTRY_URL');
  }

  public getDockerRegistryUsername(): string {
    return this.configService.get('DOCKER_REGISTRY_USERNAME');
  }

  public getDockerRegistryPassword(): string {
    return this.configService.get('DOCKER_REGISTRY_PWD');
  }

  public getAppFolder(): string {
    return '/app';
  }

  /**
   * Get the path of the volume.
   * @param path if path provided, there are join to the volume path
   */
  public getVolumePath(...path: string[]): string {
    const volumePath = this.configService.get('VOLUME_PATH');

    if (volumePath == null) {
      throw Error(`The env variable 'VOLUME_PATH' must be set.`);
    }

    return join(volumePath, ...path);
  }

  public static setEnvVariable(name: string, value: string): void {
    process.env[name] = value;
  }

  protected getConfigNumber(configName: string): number {
    try {
      return parseInt(this.configService.get(configName), 10);
    } catch (error) {
      console.error('Error while parsing config ' + configName + ' to number');
      throw error;
    }
  }

  protected getConfigBoolean(configName: string): boolean {
    const stringBool: string = this.configService.get(configName);

    if (stringBool === 'false') {
      return false;
    } else if (stringBool === 'true') {
      return true;
    } else {
      throw Error('Error while parsing config ' + configName + ' to boolean');
    }
  }
}
