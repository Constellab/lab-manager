import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { PrivateFile } from '../../core/models/private-file.class';
import { DockerService } from '../../docker/docker.service';
import { BiotaService } from '../biota/biota.service';
import { join } from 'path';
import { EnvVariableService } from '../env-variable/env-variable.service';
import { LabInitConfig } from '../lab.class';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { hashSync } from 'bcrypt';

@Injectable()
export class InitService {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private dockerService: DockerService,
    private biotaService: BiotaService,
    private envVariableService: EnvVariableService,
    private taskService: TaskService) {
  }

  public async initAll(labInitConfig: LabInitConfig): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException('You must configure the bricks before calling init');
    }
    try {
      this.logger.log('[INIT] Init started');

      // CONFIGURE LAB MANAGER
      await this.configureLabManager(labInitConfig);

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

  /**
   * Configure the lab manager to be ready to start the docker containers (but not start them)
   */
  public async configureLabManager(labInitConfig: LabInitConfig): Promise<void>{
    this.logger.log('Configuring lab manager');

    this.initAppVolume();

    this.generateFiles(labInitConfig);
    await this.envVariableService.setAllEnvVariables(this.configFileService.readConfigFile(),
      this.fileService.readPrivateFile());

    this.logger.log('Lab manager configured');
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

      // configure space information a space api key
      privateJson.space.prod_api_key = labInitConfig.space.prodApiKey;
      privateJson.space.dev_api_key = labInitConfig.space.devApiKey;
      privateJson.space.api_url = labInitConfig.space.apiUrl;
      privateJson.space.front_url = labInitConfig.space.frontUrl;

      // Community information
      privateJson.community.front_url = labInitConfig.community.frontUrl;
      privateJson.community.api_url = labInitConfig.community.apiUrl;
      privateJson.community.api_key = labInitConfig.community.apiKey;

      // Backup info
      privateJson.backup = {
        enable: labInitConfig.labConfig?.enableBackup ?? true
      }

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

      // open ai
      privateJson.openai_api_key = labInitConfig.openaiApiKey;

      this.fileService.createPrivateFile(privateJson);
      this.taskService.markTaskAsSuccess(taskName, 'private.json file generated');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, `Error while generating private.json file : ${e.message}`);
      throw e;
    }
  }
}
