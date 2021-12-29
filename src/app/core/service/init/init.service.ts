import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {CoreConfigService} from '../config/core-config.service';
import {FileService} from '../file/file.service';
import {PrivateFile} from '../../model/private-file.class';
import {KeyGeneratorService} from '../key-generator/key-generator.service';
import {ConfigFile} from '../../model/config-file.class';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private coreService: CoreConfigService,
    private fileService: FileService,
    private keyGenerator: KeyGeneratorService) {

  }


  onApplicationBootstrap(): void {
    if (!this.fileService.privateFileExists()) {
      this.generatePrivateFile();
    }

    if (!this.fileService.configFileExists()) {
      this.generateConfigFile();
    }
  }

  private generatePrivateFile(): void {
    this.logger.log('Generating private.json file');
    const privateJson: PrivateFile = this.fileService.readPrivateTemplateFile();

    // configure central information a central api key
    if (privateJson.central.api_key == null) {
      privateJson.central.api_key = this.keyGenerator.generateRandomKey(96);
    }
    privateJson.central.api_url = this.coreService.getCentralApiUrl();

    // generate the lab token
    if (privateJson.lab.token == null) {
      privateJson.lab.token = this.keyGenerator.generateRandomKey(96);
    }

    this.fileService.createPrivateFile(privateJson);
    this.logger.log('private.json file generated');
  }

  private generateConfigFile(): void {
    this.logger.log('Generating config.json file');

    const configJson: ConfigFile = this.fileService.readConfigTemplateFile();
    this.fileService.createConfigFile(configJson);

    this.logger.log('config.json file generated');
  }


}
