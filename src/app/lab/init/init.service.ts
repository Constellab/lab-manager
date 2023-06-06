import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { PrivateFile } from '../../core/models/private-file.class';
import { DockerService } from '../docker/docker.service';
import { BiotaService } from '../biota/biota.service';
import { join } from 'path';
import { EnvVariableService } from '../env-variable/env-variable.service';
import { LabInitConfig } from '../lab.class';
import { ConfigFileService } from '../config-file/config-file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { hashSync } from 'bcrypt';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private dockerService: DockerService,
    private biotaService: BiotaService,
    private envVariableService: EnvVariableService,
    private taskService: TaskService) {
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
      await this.envVariableService.setAllEnvVariables(this.configFileService.readConfigFile(),
        this.fileService.readPrivateFile());

      await this.loginToDockerRegistry();

      // PULL BIOTA DB
      await this.biotaService.pullBiota();

      // PULL IMAGES
      await this.dockerService.pullContainers();

      // UP CONTAINERS
      await this.dockerService.restartContainers({});

      // save the init version
      this.fileService.updatePrivateFileData({last_init_manager_version: this.configService.getLabManagerVersion()})

      // clean unused docker images
      await this.dockerService.systemPrune()

      this.logger.log('[INIT] Init ended successfully');

    } catch (e) {
      this.logger.error('[INIT] Init ended with error :' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }
  }

  private initAppVolume(): void {
    const taskName = 'GENERATE_APP_VOLUME';

    try {
      this.taskService.newTask(taskName, 'Generating app volume');

      const appFolder = this.configService.getAppFolder();

      this.fileService.createDirIfNotExists(join(appFolder, 'prod', 'lab', '.sys'), true);
      this.fileService.createDirIfNotExists(join(appFolder, 'prod', 'data'), true);
      this.fileService.createDirIfNotExists(join(appFolder, 'dev', 'lab', '.sys'), true);
      this.fileService.createDirIfNotExists(join(appFolder, 'dev', 'data'), true);
      this.fileService.createDirIfNotExists(join(appFolder, 'conf'));

      this.taskService.markTaskAsSuccess(taskName, 'App volume generated');
    }
    catch (e) {
      this.taskService.markTaskAsError(taskName, `Error while generating app volume : ${e.message}`);
      throw e;
    }

  }

  private generateFiles(labInitConfig: LabInitConfig): void {
    this.generatePrivateFile(labInitConfig);

    this.dockerService.generateDockerCompose();
  }

  private generatePrivateFile(labInitConfig: LabInitConfig): void {
    const taskName = 'GENERATE_PRIVATE_FILE';
    try {
      this.taskService.newTask(taskName, 'Generating private.json file');

      const privateJson: PrivateFile = this.fileService.getPrivateFileTemplate();

      let oldPrivateJson: PrivateFile = null;
      // if the private file already exists, retrieve the data sub object from it
      if (this.fileService.privateFileExists()) {
        oldPrivateJson = this.fileService.readPrivateFile();
        privateJson.data = oldPrivateJson.data;
      }

      // configure central information a central api key
      privateJson.central.api_key = labInitConfig.centralApiKey;
      privateJson.central.api_url = labInitConfig.centralApiUrl;
      privateJson.central.front_url = labInitConfig.centralFrontUrl;

      // Community information
      privateJson.community.front_url = labInitConfig.hubFrontUrl || labInitConfig.communityFrontUrl;
      privateJson.community.api_url = labInitConfig.communityApiUrl;
      privateJson.community.api_key = labInitConfig.communityApiKey;

      // Docker registry info
      privateJson.docker_registry.url = labInitConfig.dockerRegistry.url;
      privateJson.docker_registry.username = labInitConfig.dockerRegistry.username;
      privateJson.docker_registry.password = labInitConfig.dockerRegistry.password;


      // set token, only update the hash when the token has changed.
      // otherwise a new hash is created each time and as the hash is used 
      // as env variable for codelab, this would force re-creation.
      // if the token has not changed and the hash was already set
      if(oldPrivateJson && oldPrivateJson.lab.token === labInitConfig.codelabToken && oldPrivateJson.lab.hashToken){
        privateJson.lab.token = oldPrivateJson.lab.token;
        privateJson.lab.hashToken = oldPrivateJson.lab.hashToken;
      }else{
        privateJson.lab.token = labInitConfig.codelabToken;
        // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
        privateJson.lab.hashToken = hashSync(privateJson.lab.token, 10);
      }

      // DB information
      privateJson.db.gws_core_prod_password = labInitConfig.gwsCoreProdPassword;
      privateJson.db.gws_core_dev_password = labInitConfig.gwsCoreDevPassword;

      // captcha site key
      privateJson.lab.captchaSiteKey = labInitConfig.captchaSiteKey;

      this.fileService.createPrivateFile(privateJson);
      this.taskService.markTaskAsSuccess(taskName, 'private.json file generated');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, `Error while generating private.json file : ${e.message}`);
      throw e;
    }
  }

  private async loginToDockerRegistry(): Promise<void> {
    try {
      await this.dockerService.login();
    } catch (e: any) {
    }
  }
}
