import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hashSync } from 'bcrypt';
import { join } from 'path';
import { TaskService } from 'src/app/core/services/task/task.service';
import { PrivateFile } from '../../core/models/private-file.class';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerComposeAggregateService } from '../../docker/compose/docker-compose-aggregate.service';
import { MainComposeService } from '../../docker/compose/main-compose.service';
import { BiotaService } from '../biota/biota.service';
import { EnvVariableService } from '../env-variable/env-variable.service';
import { LabInitConfig } from '../lab.class';

@Injectable()
export class InitService {
  private readonly logger = new Logger(InitService.name);

  constructor(
    private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private mainComposeService: MainComposeService,
    private biotaService: BiotaService,
    private envVariableService: EnvVariableService,
    private taskService: TaskService,
    private aggregateComposeService: DockerComposeAggregateService
  ) {}

  public async configureAndInitLab(labInitConfig: LabInitConfig): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException('You must configure the bricks before calling init');
    }
    try {
      this.logger.log('[FULL INIT] Full init started');

      this.configureLabManager(labInitConfig);

      await this.init();

      this.logger.log('[FULL INIT] Full init ended successfully');
    } catch (e) {
      this.logger.error('[FULL INIT] Full init ended with error :' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }
  }

  public async initLab(): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException('You must configure the bricks before calling init');
    }
    try {
      await this.init();

      this.logger.log('[INIT] Init ended successfully');
    } catch (e) {
      this.logger.error('[INIT] Init ended with error :' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }
  }

  private async init(): Promise<void> {
    await this.configureDockerCompose();

    // PULL BIOTA DB
    await this.biotaService.pullBiota();

    // PULL IMAGES
    await this.aggregateComposeService.pullMainServices();

    // UP CONTAINERS
    await this.aggregateComposeService.restartMainServices({});

    // save the init version
    this.fileService.updatePrivateFileData({
      last_init_manager_version: this.configService.getLabManagerVersion(),
    });
  }

  /**
   * Configure the lab manager to be ready to start the docker containers (but not start them)
   */
  public configureLabManager(labInitConfig: LabInitConfig): void {
    this.generatePrivateFile(labInitConfig);
  }

  /**
   * Method to configure the docker compose file
   * It generates the docker compose file and the env variables file
   */
  public async configureDockerCompose(): Promise<void> {
    await this.mainComposeService.generateDockerCompose();

    await this.envVariableService.setAllEnvVariables(
      this.configFileService.readConfigFile(),
      this.fileService.readPrivateFile()
    );
  }

  private generatePrivateFile(labInitConfig: LabInitConfig): void {
    const taskName = 'Generate configuration file';
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
        enable: labInitConfig.labConfig?.enableBackup ?? true,
      };

      // set token, only update the hash when the token has changed.
      // otherwise a new hash is created each time and as the hash is used
      // as env variable for codelab, this would force re-creation.
      // if the token has not changed and the hash was already set
      if (labInitConfig.codelabToken) {
        if (
          oldPrivateJson &&
          oldPrivateJson.lab.codelabToken === labInitConfig.codelabToken &&
          oldPrivateJson.lab.codelabHashToken
        ) {
          privateJson.lab.codelabToken = oldPrivateJson.lab.codelabToken;
          privateJson.lab.codelabHashToken = oldPrivateJson.lab.codelabHashToken;
        } else {
          privateJson.lab.codelabToken = labInitConfig.codelabToken;
          // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
          privateJson.lab.codelabHashToken = hashSync(privateJson.lab.codelabToken, 10);
        }
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
