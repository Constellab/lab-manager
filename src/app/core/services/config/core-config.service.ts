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

  public getLabManagerVersion(): string {
    return this.configService.get('LAB_MANAGER_VERSION');
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

  public getAppFolder(): string {
    return '/app';
  }

  public getProdFolderPath(): string {
    return join(this.getAppFolder(), 'prod');
  }

  public getProdDataFolder(): string {
    return join(this.getProdFolderPath(), 'data');
  }

  public getProdSettingsFolder(): string {
    return join(this.getProdFolderPath(), 'settings', 'glab');
  }

  public getGwsDbFolder(): string {
    return '/gws_db';
  }

  public getBiotaDbFolder(): string {
    return join(this.getGwsDbFolder() ,'gws_biota');
  }

  public getGwsCoreDbFolder(): string{
    return join(this.getGwsDbFolder() , 'gws_core');
  }

  public getGwsCoreDbProdMariaDbFolder(): string{
    return join(this.getGwsCoreDbFolder(), 'prod', 'mariadb');
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

  public static getEnvVariable(name: string): string {
    return process.env[name];
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
