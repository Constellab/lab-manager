import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hashSync } from 'bcrypt';
import { TaskService } from 'src/app/core/services/task/task.service';
import { PrivateFile } from '../../core/models/private-file.class';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerComposeAggregateService } from '../../docker/compose/docker-compose-aggregate.service';
import { MainComposeService } from '../../docker/compose/main-compose.service';
import { DockerContainerService } from '../../docker/container/docker-container.service';
import { EnvVariableService } from '../env-variable/env-variable.service';
import { LabInitConfig } from '../lab.class';
import { MigrationService } from './migration/migration.service';

@Injectable()
export class InitService {
  private readonly logger = new Logger(InitService.name);

  constructor(
    private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private mainComposeService: MainComposeService,
    private envVariableService: EnvVariableService,
    private taskService: TaskService,
    private aggregateComposeService: DockerComposeAggregateService,
    private migrationService: MigrationService,
    private dockerContainerService: DockerContainerService
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
    // Run migrations first, before configuring docker compose
    // If migrations fail, the init process will stop
    await this.migrationService.executeMigrations();

    await this.configureDockerCompose();

    
    // UP CONTAINERS
    await this.aggregateComposeService.restartMainServices({ updateContainers: true });
    
    // Prune unused images before starting containers
    await this.dockerContainerService.pruneUnusedImages();
    
    // wait for 10 seconds to let the containers start
    // so the progress of the glab is updated before the lab is marked as idle
    // because is not waiting, there is a small gap where we can't detect the lab
    // is starting
    // + there is not problem in waiting because the lab takes more time to be ready
    // and this is running in background
    const taskName = 'Starting lab';
    this.taskService.newTask(taskName);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    this.taskService.markTaskAsSuccess(taskName, 'Lab started');

    // save the init version and the config hash used for this restart,
    // so we can later detect if the config was changed since the last restart.
    // The lab has just (re)started with the current config and manager version,
    // so any pending "needs restart" state is cleared here.
    this.fileService.updatePrivateFileData({
      lastInitManagerVersion: this.configService.getLabManagerVersion(),
      lastInitConfigHash: this.configFileService.getConfigHash(),
      needsRestart: false,
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

      // Preserve prior lab id/name across re-template, or fall back to env vars on fresh install
      privateJson.lab.id = labInitConfig.lab.id;
      privateJson.lab.name = labInitConfig.lab.name;

      // configure space information a space api key
      privateJson.space.prodApiKey = labInitConfig.space.prodApiKey;
      privateJson.space.devApiKey = labInitConfig.space.devApiKey;
      privateJson.space.apiUrl = labInitConfig.space.apiUrl;
      privateJson.space.frontUrl = labInitConfig.space.frontUrl;

      // Community information
      privateJson.community.frontUrl = labInitConfig.community.frontUrl;
      privateJson.community.apiUrl = labInitConfig.community.apiUrl;

      // Backup info
      privateJson.backup = {
        enable: labInitConfig.backup?.enable ?? true,
      };

      // set token, only update the hash when the token has changed.
      // otherwise a new hash is created each time and as the hash is used
      // as env variable for codelab, this would force re-creation.
      // if the token has not changed and the hash was already set
      if (labInitConfig.lab.codelabToken) {
        if (
          oldPrivateJson &&
          oldPrivateJson.lab.codelabToken === labInitConfig.lab.codelabToken &&
          oldPrivateJson.lab.codelabHashToken
        ) {
          privateJson.lab.codelabToken = oldPrivateJson.lab.codelabToken;
          privateJson.lab.codelabHashToken = oldPrivateJson.lab.codelabHashToken;
        } else {
          privateJson.lab.codelabToken = labInitConfig.lab.codelabToken;
          // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
          privateJson.lab.codelabHashToken = hashSync(privateJson.lab.codelabToken, 10);
        }
      }

      // DB information
      privateJson.db.gwsCoreProdPassword = labInitConfig.db.gwsCoreProdPassword;
      privateJson.db.gwsCoreDevPassword = labInitConfig.db.gwsCoreDevPassword;

      // captcha site key
      privateJson.lab.captchaSiteKey = labInitConfig.lab.captchaSiteKey;

      // open ai
      privateJson.openaiApiKey = labInitConfig.openaiApiKey;

      this.fileService.createPrivateFile(privateJson);
      this.taskService.markTaskAsSuccess(taskName, 'private.json file generated');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, `Error while generating private.json file : ${e.message}`);
      throw e;
    }
  }
}
