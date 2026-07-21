import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConfigFile, ConfigFileBrick } from '../../models/config-file.class';
import { ClVersion } from '../../models/version.class';
import { FileService } from '../file/file.service';

@Injectable()
export class ConfigFileService {
  private readonly configFileName = 'config.json';

  private readonly logger = new Logger(ConfigFileService.name);

  constructor(private fileService: FileService) {}

  /**
   * Update the config and store result in config file.
   *
   * Any change to the config (bricks, MCP flag, custom env variables, ...) means
   * the lab must be restarted for it to take effect, so the "needs restart" flag
   * is set here -- this is the single chokepoint every config write goes through.
   * The flag is reset to false on the next lab start (InitService.init). We only
   * mark once the lab has been initialized (a private file exists); config writes
   * that happen during migrations at init time are harmless because init resets
   * the flag after them.
   */
  public updateConfig(config: ConfigFile): void {
    this.fileService.writeJsonFile(this.configFilePath, config);

    if (this.fileService.privateFileExists()) {
      this.fileService.updatePrivateFileData({ needsRestart: true });
    }
  }

  public getConfig(): ConfigFile {
    if (!this.configFileExists()) {
      return null;
    }

    return this.readConfigFile();
  }

  /**
   * Update bricks to a minimum version. Only updates if:
   * - The brick exists in the config
   * - The current version is lower than the minimum version
   * @param bricksWithMinVersion Array of bricks with their minimum required versions
   */
  public updateBricksToMinimumVersion(bricksWithMinVersion: ConfigFileBrick[]): void {
    const config = this.getConfig();
    if (!config || !config.environment || !config.environment.bricks) {
      this.logger.warn('Config file does not exist or has no bricks. Skipping brick version update.');
      return;
    }

    let configUpdated = false;

    for (const minBrick of bricksWithMinVersion) {
      const existingBrick = config.environment.bricks.find((b) => b.name === minBrick.name);

      if (!existingBrick) {
        this.logger.debug(`Brick '${minBrick.name}' not found in config. Skipping.`);
        continue;
      }

      try {
        const currentVersion = ClVersion.fromString(existingBrick.version);
        const minimumVersion = ClVersion.fromString(minBrick.version);

        if (currentVersion.isHigher(minimumVersion) || currentVersion.isEqual(minimumVersion)) {
          this.logger.debug(
            `Brick '${minBrick.name}' version ${existingBrick.version} is already ` +
              `equal or higher than minimum ${minBrick.version}. Skipping.`
          );
          continue;
        }

        this.logger.log(
          `Updating brick '${minBrick.name}' from version ${existingBrick.version} to ${minBrick.version}`
        );
        existingBrick.version = minBrick.version;
        configUpdated = true;
      } catch (error) {
        this.logger.error(
          `Error comparing versions for brick '${minBrick.name}': ${error.message}. Skipping this brick.`
        );
      }
    }

    if (configUpdated) {
      this.updateConfig(config);
      this.logger.log('Config file updated with new brick versions.');
    } else {
      this.logger.debug('No brick versions needed to be updated.');
    }
  }

  /**
   * Compute a hash of the current config file content.
   * Used to detect whether the config was changed since the last lab restart.
   * Returns null if the config file does not exist.
   */
  public getConfigHash(): string | null {
    const config = this.getConfig();
    if (!config) {
      return null;
    }

    return createHash('sha256').update(JSON.stringify(config)).digest('hex');
  }

  ///////////////////////////// FILE  ///////////////////////////////

  public configFileExists(): boolean {
    return this.fileService.exists(this.configFilePath);
  }

  public readConfigFile(): ConfigFile {
    if (!this.configFileExists()) {
      throw new BadRequestException('The config file does not exist. You must configure the bricks.');
    }
    return this.fileService.readJsonFile(this.configFilePath);
  }

  private get configFilePath(): string {
    return this.fileService.getConfPath(this.configFileName);
  }
}
