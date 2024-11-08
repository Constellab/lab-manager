import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigFile } from '../../core/models/config-file.class';
import { PrivateFile } from '../../core/models/private-file.class';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';


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

  constructor(private fileService: FileService,
    private gpuService: GPUService,
    private taskService: TaskService) {
  }

  /**
   * Set all the env variable necessary for the docker-compose file
   */
  public async setAllEnvVariables(configJson: ConfigFile, privateJson: PrivateFile): Promise<void> {
    const taskName = 'SET_ENV_VARIABLES';

    try {
      this.taskService.newTask(taskName, 'Initializing env variable');

      const envVariables = new EnvVariables();


      if(configJson == null){
        throw new BadRequestException('The config was not provided. Was the lab configured ?');
      }
      
      if(privateJson == null){
        throw new BadRequestException('The private file was not provided. Was the lab initiliazed ?');
      }

      if (privateJson.lab.token == null) {
        throw new BadRequestException('Lab token is not set in the private file');
      }


      // FROM CONFIG
      envVariables.addEnvVariable('LAB_ID', configJson.lab_id);
      envVariables.addEnvVariable('LAB_NAME', configJson.name);

      // FRONT VERSION
      envVariables.addEnvVariable('FRONT_VERSION', configJson.front_version);

      // GLAB TAG
      envVariables.addEnvVariable('GLAB_TAG', configJson.glab_tag);

      envVariables.addEnvVariable('SPACE_PROD_API_KEY', privateJson.space.prod_api_key);
      envVariables.addEnvVariable('SPACE_DEV_API_KEY', privateJson.space.dev_api_key);
      envVariables.addEnvVariable('SPACE_API_URL', privateJson.space.api_url);
      envVariables.addEnvVariable('SPACE_FRONT_URL', privateJson.space.front_url);

      if(privateJson.community){
        envVariables.addEnvVariable('COMMUNITY_FRONT_URL', privateJson.community.front_url);
        envVariables.addEnvVariable('COMMUNITY_API_URL', privateJson.community.api_url);
        envVariables.addEnvVariable('COMMUNITY_API_KEY', privateJson.community.api_key);
      }
      
      envVariables.addEnvVariable('GWS_CORE_PROD_DB_PASSWORD', privateJson.db.gws_core_prod_password);
      envVariables.addEnvVariable('GWS_CORE_DEV_DB_PASSWORD', privateJson.db.gws_core_dev_password);

      envVariables.addEnvVariable('HT_PASSWD', `${privateJson.lab.username}:${privateJson.lab.hashToken}`);

      // OTHERS
      const isGpu: boolean = await this.gpuService.isGpu();
      envVariables.addEnvVariable('GPU', isGpu ? 'cuda' : '');
      // set the TAG_PREFIX to use the correct image based on if GPU is on
      envVariables.addEnvVariable('TAG_PREFIX', isGpu ? 'gpu-': '');

      // CAPTCHA
      envVariables.addEnvVariable('CAPTCHA_SITE_KEY', privateJson.lab.captchaSiteKey);
      
      // OPEN AI KEY
      envVariables.addEnvVariable('OPENAI_API_KEY', privateJson.openai_api_key);


      // write the env variables to the .env file
      this.fileService.updateEnvFile(envVariables.toString());

      this.taskService.markTaskAsSuccess(taskName, 'Env variables set');
    }
    catch (error) {
      this.taskService.markTaskAsError(taskName, `Error while setting env variables: ${error.message}`);
      throw error;
    }
  }
}
