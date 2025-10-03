import { Inject, Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EnvironmentProfile } from '../../models/config.class';
import { CORE_MODULE_PROVIDER, CoreModuleConfig } from '../../models/core-module-config.class';

export const ENVIRONMENT_PROFILE_KEY = 'ENVIRONMENT_PROFILE';

@Injectable()
export class CoreConfigService {
  constructor(
    private configService: ConfigService,
    @Inject(CORE_MODULE_PROVIDER) private config: CoreModuleConfig
  ) {}

  public getEnvironmentProfile(): EnvironmentProfile {
    return this.configService.get(ENVIRONMENT_PROFILE_KEY);
  }

  public isProduction(): boolean {
    return this.getEnvironmentProfile() === 'prod';
  }

  public isDevelopment(): boolean {
    return this.getEnvironmentProfile() === 'dev';
  }

  public isDesktop(): boolean {
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

  public getAutoStartLab(): boolean {
    return this.getConfigBoolean('AUTO_START_LAB', true);
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

  public getAppHostsCount(): number {
    return this.getConfigNumber('APP_NB_COUNT');
  }

  public getAppDefaultPort(): number {
    return 8501;
  }

  public getPort(): number {
    return this.getConfigNumber('PORT');
  }

  //////////////////////// FOLDERS ////////////////////////

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

  // app/conf
  public getConfFolder(): string {
    return join(this.getVolumePath(), 'conf');
  }

  // app/gws_db
  public getGwsDbFolder(): string {
    return this.getVolumePath() + '/gws_db';
  }

  // app/gws_db/gws_biota
  public getBiotaDbFolder(): string {
    return join(this.getGwsDbFolder(), 'gws_biota');
  }

  // app/gws_db/gws_core
  public getGwsCoreDbFolder(): string {
    return join(this.getGwsDbFolder(), 'gws_core');
  }

  /**
   * Check if a file exists in dist folder
   * @param path
   */
  public getDistPath(...path: string[]): string {
    return join(this.config.distFolder, ...path);
  }

  public getAssetPath(...path: string[]): string {
    return this.getDistPath(this.config.assetsFolderName, ...path);
  }

  //////////////////////// PROD FOLDERS ////////////////////////

  // app/prod/data
  public getProdDataFolder(): string {
    return join(this.getProdFolderPath(), 'data');
  }

  // app/prod/settings/glab
  public getProdSettingsFolder(): string {
    return join(this.getProdFolderPath(), 'settings', 'glab');
  }

  // app/prod
  public getProdFolderPath(): string {
    return join(this.getVolumePath(), 'prod');
  }

  // app/prod/lab
  public getProdLabFolder(): string {
    return join(this.getProdFolderPath(), 'lab');
  }

  // app/prod/lab/.sys/start-log.json
  public getProdStartLogFile(): string {
    return join(this.getProdLabFolder(), '.sys', 'start-log.json');
  }

  // app/gws_db/gws_core/prod/mariadb
  public getGwsCoreDbProdMariaDbFolder(): string {
    return join(this.getGwsCoreDbFolder(), 'prod', 'mariadb');
  }

  // Folder for sub composes volumes
  public getProdDataExtensionsFolder(): string {
    return join(this.getProdDataFolder(), 'extensions');
  }

  //////////////////////// DEV FOLDERS ////////////////////////

  // app/dev
  public getDevFolderPath(): string {
    return join(this.getVolumePath(), 'dev');
  }

  // app/dev/lab
  public getDevLabFolder(): string {
    return join(this.getDevFolderPath(), 'lab');
  }

  // app/dev/data
  public getDevDataFolder(): string {
    return join(this.getDevFolderPath(), 'data');
  }

  // app/dev/settings/glab
  public getDevSettingsFolder(): string {
    return join(this.getDevFolderPath(), 'settings', 'glab');
  }

  // app/dev/lab/.sys/start-log.json
  public getDevStartLogFile(): string {
    return join(this.getDevFolderPath(), 'lab', '.sys', 'start-log.json');
  }

  // app/dev/.ssh
  public getDevEnvSSHFolder(): string {
    return join(this.getDevFolderPath(), '.ssh');
  }

  // app/gws_db/gws_core/dev/mariadb
  public getGwsCoreDbDevMariaDbFolder(): string {
    return join(this.getGwsCoreDbFolder(), 'dev', 'mariadb');
  }

  public getDevDataExtensionsFolder(): string {
    return join(this.getDevDataFolder(), 'extensions');
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

  protected getConfigBoolean(configName: string, defaultValue?: boolean): boolean {
    const stringBool: string = this.configService.get(configName);

    if (stringBool === 'false') {
      return false;
    } else if (stringBool === 'true') {
      return true;
    } else {
      if (defaultValue !== undefined) {
        return defaultValue;
      } else {
        throw Error('Error while parsing config ' + configName + ' to boolean');
      }
    }
  }
}
