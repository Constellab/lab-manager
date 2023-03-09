import {BadRequestException, Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {FileService} from '../../core/services/file/file.service';
import {PrivateFile} from '../../core/models/private-file.class';
import {DockerService} from '../docker/docker.service';
import {BiotaService} from '../biota/biota.service';
import {join} from 'path';
import {EnvVariableService} from '../env-variable/env-variable.service';
import {LabInitConfig} from '../lab.class';
import {ConfigFileService} from '../config-file/config-file.service';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private dockerService: DockerService,
    private biotaService: BiotaService,
    private envVariableService: EnvVariableService) {
  }

  onApplicationBootstrap(): any {
  }

  public async initAll(labInitConfig: LabInitConfig): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException('You must configure the bricks before calling init');
    }
    try {
      this.logger.log('[INIT] Init started');

      this.initAppVolume();


      this.generateFiles(labInitConfig);
      await this.envVariableService.setEnvVariables();

      await this.loginToDockerRegistry();

      // PULL BIOTA DB
      await this.biotaService.pullBiota(false);

      // PULL IMAGES
      await this.dockerService.pullContainers();

      // UP CONTAINERS
      await this.dockerService.upContainers({});

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
    this.generatePrivateFile(labInitConfig);

    this.dockerService.generateDockerCompose();
  }

  private generatePrivateFile(labInitConfig: LabInitConfig): void {
    this.logger.log('Generating private.json file');
    const privateJson: PrivateFile = this.fileService.readPrivateTemplateFile();

    // configure central information a central api key
    privateJson.central.api_key = labInitConfig.centralApiKey;
    privateJson.central.api_url = labInitConfig.centralApiUrl;
    privateJson.central.front_url = labInitConfig.centralFrontUrl;

    // hub information
    privateJson.hub.front_url = labInitConfig.hubFrontUrl;

    // set token
    privateJson.lab.token = labInitConfig.codelabToken;

    // DB information
    privateJson.db.gws_core_prod_password = labInitConfig.gwsCoreProdPassword;
    privateJson.db.gws_core_dev_password = labInitConfig.gwsCoreDevPassword;

    this.fileService.createPrivateFile(privateJson);
    this.logger.log('private.json file generated');
  }

  private async loginToDockerRegistry(): Promise<void> {
    try {
      await this.dockerService.login();
    } catch (e: any) {
    }
  }
}
