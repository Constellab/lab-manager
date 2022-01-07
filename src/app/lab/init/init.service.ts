import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {FileService} from '../../core/services/file/file.service';
import {PrivateFile} from '../../core/models/private-file.class';
import {ConfigFile} from '../../core/models/config-file.class';
import {DockerService} from '../docker/docker.service';
import {BiotaService} from '../../core/services/biota/biota.service';
import {join} from 'path';
import {EnvVariableService} from '../../core/services/env-variable/env-variable.service';
import {LabInitConfig} from '../lab.class';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private fileService: FileService,
    private dockerService: DockerService,
    private biotaService: BiotaService,
    private envVariableService: EnvVariableService) {
  }

  onApplicationBootstrap(): any {
  }

  public async initAll(labInitConfig: LabInitConfig): Promise<void> {
    try {
      this.logger.log('[INIT] Init started');

      this.initAppVolume();

      this.generateFiles(labInitConfig);
      await this.envVariableService.setEnvVariables();

      await this.loginToDockerRegistry();

      // PULL BIOTA DB
      // todo do it only if biota is required
      await this.biotaService.pullBiota(false);

      // PULL IMAGES
      await this.dockerService.pullContainers(false);

      // UP CONTAINERS
      await this.dockerService.upContainers({}, false);

      this.logger.log('[INIT] Init ended successfully');

    } catch (e) {
      this.logger.error('[INIT] Init ended with error :' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }
  }

  private initAppVolume(): void {
    this.logger.log('Generating app volumes');

    const appFolder = this.configService.getAppFolder();

    this.fileService.createDirIfNotExists(join(appFolder, 'prod', 'lab', '.sys'), true);
    this.fileService.createDirIfNotExists(join(appFolder, 'prod', 'data'), true);
    this.fileService.createDirIfNotExists(join(appFolder, 'dev', 'lab', '.sys'), true);
    this.fileService.createDirIfNotExists(join(appFolder, 'dev', 'data'), true);
    this.fileService.createDirIfNotExists(join(appFolder, 'conf'));

    this.logger.log('App volume generated');
  }

  private generateFiles(labInitConfig: LabInitConfig): void {
    if (!this.fileService.privateFileExists()) {
      this.generatePrivateFile(labInitConfig);
    }

    if (!this.fileService.configFileExists()) {
      this.generateConfigFile();
    }
    this.generateDockerCompose();
  }

  private generatePrivateFile(labInitConfig: LabInitConfig): void {
    this.logger.log('Generating private.json file');
    const privateJson: PrivateFile = this.fileService.readPrivateTemplateFile();

    // configure central information a central api key
    privateJson.central.api_key = labInitConfig.centralApiKey;
    privateJson.central.api_url = this.configService.getCentralApiUrl();

    // set token
    privateJson.lab.token = labInitConfig.codelabToken;

    this.fileService.createPrivateFile(privateJson);
    this.logger.log('private.json file generated');
  }

  private generateConfigFile(): void {
    this.logger.log('Generating config.json file');

    const configJson: ConfigFile = this.fileService.readConfigTemplateFile();
    this.fileService.createConfigFile(configJson);

    this.logger.log('config.json file generated');
  }

  private generateDockerCompose(): void {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    this.fileService.copyDockerCompose();
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private async loginToDockerRegistry(): Promise<void> {
    try {
      await this.dockerService.login();
    } catch (e: any) {
    }
  }
}
