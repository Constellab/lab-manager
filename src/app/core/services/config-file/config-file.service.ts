import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigFile } from '../../models/config-file.class';
import { CoreConfigService } from '../config/core-config.service';
import { FileService } from '../file/file.service';

@Injectable()
export class ConfigFileService {
  private readonly configFileName = 'config.json';

  private readonly logger = new Logger(ConfigFileService.name);

  constructor(
    private fileService: FileService,
    private coreConfigService: CoreConfigService
  ) {}

  /**
   * Update the config and store result in config file
   */
  public updateConfig(config: ConfigFile): void {
    if (!config.name) {
      config.name = this.getLabName();
    }

    if (!config.lab_id) {
      config.lab_id = this.getLabId();
    }

    this.fileService.writeJsonFile(this.configFilePath, config);
  }

  public getConfig(): ConfigFile {
    if (!this.configFileExists()) {
      return null;
    }

    return this.readConfigFile();
  }

  private getLabName(): string {
    if (this.configFileExists()) {
      try {
        const name = this.readConfigFile().name;
        if (name) return name;
      } catch (e) {
        this.logger.error('Error while reading lab name from config file. ' + e);
      }
    }

    // return the default name
    return this.coreConfigService.getLabName();
  }

  private getLabId(): string {
    if (this.configFileExists()) {
      try {
        const id = this.readConfigFile().lab_id;
        if (id) return id;
      } catch (e) {
        this.logger.error('Error while reading lab id from config file. ' + e);
      }
    }

    // return the default id
    return this.coreConfigService.getLabId();
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
