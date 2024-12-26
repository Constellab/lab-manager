import { Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentProfile } from '../../models/config.class';
import { join } from 'path';

export const ENVIRONMENT_PROFILE_KEY = 'ENVIRONMENT_PROFILE';

@Injectable()
export class CoreConfigService {
  constructor(private configService: ConfigService) {}

  public getEnvironmentProfile(): EnvironmentProfile {
    return this.configService.get(ENVIRONMENT_PROFILE_KEY);
  }

  public isProduction(): boolean {
    return this.getEnvironmentProfile() === 'prod';
  }

  public isDekstop(): boolean {
    return this.getEnvironmentProfile() === 'desktop';
  }

  public isLocal(): boolean {
    const env: EnvironmentProfile = this.getEnvironmentProfile();
    return env === 'dev' || env === 'test' || env === 'desktop';
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

  /**
   * Provided for on premise installations. Can be used to add additional hosts to the lab manager
   * to enable access to apps from other domains.
   */
  public getAddtionalDomains(): string[] {
    const domains = this.configService.get('ADDITIONAL_DOMAINS');
    try {
      return JSON.parse(domains);
    } catch (e) {
      throw Error(
        'Error while parsing environment variable ADDITIONAL_DOMAINS to array. It must be a valid JSON array.'
      );
    }
  }

  public getLabManagerStandaloneFrontVersion(): string {
    return this.configService.get('LAB_MANAGER_STANDALONE_FRONT_VERSION');
  }

  public getLabName(): string | null {
    return this.configService.get('LAB_NAME');
  }

  public getLabId(): string | null {
    return this.configService.get('LAB_ID');
  }

  public getDesktopCommunityApiUrl(): string {
    return this.configService.get('DESKTOP_COMMUNITY_API_URL');
  }

  public getDesktopCommunityFrontUrl(): string {
    return this.configService.get('DESKTOP_COMMUNITY_FRONT_URL');
  }

  public getAppFolder(): string {
    return '/app';
  }

  public getPort(): number {
    return this.getConfigNumber('PORT');
  }

  public getProdFolderPath(): string {
    return join(this.getAppFolder(), 'prod');
  }

  public getDevFolderPath(): string {
    return join(this.getAppFolder(), 'dev');
  }

  public getProdDataFolder(): string {
    return join(this.getProdFolderPath(), 'data');
  }

  public getProdSettingsFolder(): string {
    return join(this.getProdFolderPath(), 'settings', 'glab');
  }

  public getGwsDbFolder(): string {
    return this.getAppFolder() + '/gws_db';
  }

  public getProdStartLogFile(): string {
    return join(this.getProdFolderPath(), 'lab', '.sys', 'start-log.json');
  }

  public getDevStartLogFile(): string {
    return join(this.getDevFolderPath(), 'lab', '.sys', 'start-log.json');
  }

  public getBiotaDbFolder(): string {
    return join(this.getGwsDbFolder(), 'gws_biota');
  }

  public getGwsCoreDbFolder(): string {
    return join(this.getGwsDbFolder(), 'gws_core');
  }

  public getGwsCoreDbProdMariaDbFolder(): string {
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
