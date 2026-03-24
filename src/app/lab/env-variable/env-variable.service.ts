import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigFile } from '../../core/models/config-file.class';
import { PrivateFile } from '../../core/models/private-file.class';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';

/**
 * Simple class to generate the env variable string
 */
class EnvVariables {
  envString: string = '';

  public addEnvVariable(key: string, value: string): void {
    if (value == null) value = '';
    this.envString += `${key}="${value}"\n`;
  }

  public toString(): string {
    // replace all '$' by '$$' to escape them
    return this.envString.replace(/\$/g, '$$$$');
  }
}

@Injectable()
export class EnvVariableService {
  constructor(
    private fileService: FileService,
    private gpuService: GPUService,
    private taskService: TaskService,
    private coreConfigService: CoreConfigService
  ) {}

  /**
   * Set all the env variable necessary for the docker-compose file
   */
  public async setAllEnvVariables(configJson: ConfigFile, privateJson: PrivateFile): Promise<void> {
    const taskName = 'Configure lab manager';

    try {
      this.taskService.newTask(taskName, 'Initializing env variable');

      const envVariables = new EnvVariables();

      if (configJson == null) {
        throw new BadRequestException('The config was not provided. Was the lab configured ?');
      }

      if (privateJson == null) {
        throw new BadRequestException('The private file was not provided. Was the lab initiliazed ?');
      }

      // FROM CONFIG
      envVariables.addEnvVariable('LAB_ID', configJson.lab_id);
      envVariables.addEnvVariable('LAB_NAME', configJson.name);
      envVariables.addEnvVariable('LAB_MODE', 'prod');

      const labEnvironment = this.coreConfigService.isLocal() ? 'DESKTOP' : 'ON_CLOUD';
      envVariables.addEnvVariable('LAB_ENVIRONMENT', labEnvironment);

      // FRONT VERSION
      envVariables.addEnvVariable('FRONT_VERSION', configJson.front_version);

      // GLAB TAG
      envVariables.addEnvVariable('GLAB_TAG', configJson.glab_tag);

      envVariables.addEnvVariable('SPACE_PROD_API_KEY', privateJson.space.prod_api_key);
      envVariables.addEnvVariable('SPACE_DEV_API_KEY', privateJson.space.dev_api_key);
      envVariables.addEnvVariable('SPACE_API_URL', privateJson.space.api_url);
      envVariables.addEnvVariable('SPACE_FRONT_URL', privateJson.space.front_url);

      if (privateJson.community) {
        envVariables.addEnvVariable('COMMUNITY_FRONT_URL', privateJson.community.front_url);
        envVariables.addEnvVariable('COMMUNITY_API_URL', privateJson.community.api_url);
      }

      envVariables.addEnvVariable('GWS_CORE_PROD_DB_PASSWORD', privateJson.db.gws_core_prod_password);
      envVariables.addEnvVariable('GWS_CORE_DEV_DB_PASSWORD', privateJson.db.gws_core_dev_password);

      if (privateJson.lab.codelabHashToken) {
        envVariables.addEnvVariable(
          'HT_PASSWD',
          `${privateJson.lab.codelabUsername}:${privateJson.lab.codelabHashToken}`
        );
      }

      // OTHERS
      const isGpu: boolean = await this.gpuService.isGpu();
      envVariables.addEnvVariable('GPU', isGpu ? 'cuda' : '');
      // set the TAG_PREFIX to use the correct image based on if GPU is on
      envVariables.addEnvVariable('TAG_PREFIX', isGpu ? 'gpu-' : '');

      // CAPTCHA
      envVariables.addEnvVariable('CAPTCHA_SITE_KEY', privateJson.lab.captchaSiteKey);

      // OPEN AI KEY
      envVariables.addEnvVariable('OPENAI_API_KEY', privateJson.openai_api_key);

      // write the env variables to the .env file
      this.fileService.updateEnvFile(envVariables.toString());

      this.taskService.markTaskAsSuccess(taskName, 'Env variables set');
    } catch (error) {
      this.taskService.markTaskAsError(taskName, `Error while setting env variables: ${error.message}`);
      throw error;
    }
  }
}
