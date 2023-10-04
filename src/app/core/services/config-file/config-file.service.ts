import {BadRequestException, Injectable} from '@nestjs/common';
import {ConfigFile} from '../../models/config-file.class';
import {FileService} from '../file/file.service';

@Injectable()
export class ConfigFileService {

  private readonly configFileName = 'config.json';


  constructor(private fileService: FileService) {
  }


  /**
   * Update the config and store result in config file
   */
  public updateConfig(config: ConfigFile): void {
    this.fileService.writeJsonFile(this.configFilePath, config);
  }

  public getConfig(): ConfigFile {
    if (!this.configFileExists()) {
      return null;
    }

    return this.readConfigFile();

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

  public biotaIsActive(): boolean {
    // if the config file does not exist, we consider biota not active
    if (!this.configFileExists()) {
      return false;
    }
    return this.readConfigFile().biota_maria_db_url != null;
  }


  private get configFilePath(): string {
    return this.fileService.getVolumePath(this.configFileName);
  }

}
