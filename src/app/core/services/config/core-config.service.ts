import { Inject, Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EnvironmentProfile, LabEnvironment } from '../../models/config.class';
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

  public isPrivateCloud(): boolean {
    return this.getEnvironmentProfile() === 'private-cloud';
  }

  public isLocal(): boolean {
    const env: EnvironmentProfile = this.getEnvironmentProfile();
    return env === 'dev' || env === 'test' || env === 'desktop';
  }

  public apiKeyIsRequired(): boolean {
    return !this.isLocal() && !this.isPrivateCloud();
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
    return this.configService.get('VIRTUAL_HOST', 'localhost');
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

  //////////////////////// ENVIRONMENT-BASED FOLDERS ////////////////////////

  /**
   * Get the environment-specific folder path (prod/dev)
   * @param env Environment profile, defaults to current environment
   */
  public getEnvFolderPath(env: LabEnvironment): string {
    // Desktop and test use dev folder structure
    return join(this.getVolumePath(), env);
  }

  /**
   * Get the data folder for specified environment
   * Path: app/{env}/data
   */
  public getDataFolder(env: LabEnvironment): string {
    return join(this.getEnvFolderPath(env), 'data');
  }

  /**
   * Get the lab folder for specified environment
   * Path: app/{env}/lab
   */
  public getLabFolder(env: LabEnvironment): string {
    return join(this.getEnvFolderPath(env), 'lab');
  }

  /**
   * Get the settings folder for specified environment
   * Path: app/{env}/settings/glab
   * TODO TO SEE IF THIS IS STILL NEEDED
   */
  public getSettingsFolder(env: LabEnvironment): string {
    return join(this.getEnvFolderPath(env), 'settings', 'glab');
  }

  /**
   * Get the lab system folder for specified environment
   * Path: app/{env}/lab/.sys
   */
  public getLabSysFolder(env: LabEnvironment): string {
    return join(this.getLabFolder(env), '.sys');
  }

  /**
   * Get the start log file path for specified environment
   * Path: app/{env}/lab/.sys/start-log.json
   */
  public getStartLogFile(env: LabEnvironment): string {
    return join(this.getLabSysFolder(env), 'start-log.json');
  }

  /**
   * Get the brick data folder for specified environment
   * Path: app/{env}/lab/.sys/brick-data
   */
  public getLabBrickDataFolder(env: LabEnvironment): string {
    return join(this.getLabSysFolder(env), 'brick-data');
  }

  /**
   * Get the extensions folder for specified environment
   * Path: app/{env}/data/extensions
   */
  public getDataExtensionsFolder(env: LabEnvironment): string {
    return join(this.getDataFolder(env), 'extensions');
  }

  /**
   * Get the MariaDB folder for specified environment
   * Path: app/gws_db/gws_core/{env}/mariadb
   */
  public getGwsCoreDbMariaDbFolder(env: LabEnvironment): string {
    return join(this.getGwsCoreDbFolder(), env, 'mariadb');
  }

  /**
   * Get the SSH folder (dev environment only)
   * Path: app/dev/.ssh
   */
  public getDevEnvSSHFolder(): string {
    return join(this.getEnvFolderPath('dev'), '.ssh');
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
