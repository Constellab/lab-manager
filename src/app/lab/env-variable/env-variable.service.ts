import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigFile } from '../../core/models/config-file.class';
import { PrivateFile } from '../../core/models/private-file.class';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { hashSync } from 'bcrypt';
import { FileService } from '../../core/services/file/file.service';
import { CommandService } from '../../core/services/command/command.service';
import { ConfigFileService } from '../config-file/config-file.service';
import { TaskService } from 'src/app/core/services/task/task.service';

@Injectable()
export class EnvVariableService {

  private readonly logger = new Logger(EnvVariableService.name);

  constructor(private fileService: FileService,
    private configFileService: ConfigFileService,
    private commandService: CommandService,
    private taskService: TaskService) {
  }

  /**
   * Set all the env variable necessary for the docker-compose file
   */
  public async setEnvVariables(): Promise<void> {
    const taskName = 'SET_ENV_VARIABLES';

    try {
      this.taskService.newTask(taskName, 'Initializing env variable');

      const configJson: ConfigFile = this.configFileService.readConfigFile();
      const privateJson: PrivateFile = this.fileService.readPrivateFile();

      if (configJson.lab_id != null) {
        CoreConfigService.setEnvVariable('LAB_ID', configJson.lab_id);
      }
      CoreConfigService.setEnvVariable('LAB_NAME', configJson.name);
      CoreConfigService.setEnvVariable('LAB_TOKEN', privateJson.lab.token);

      CoreConfigService.setEnvVariable('CENTRAL_API_KEY', privateJson.central.api_key);
      CoreConfigService.setEnvVariable('CENTRAL_API_URL', privateJson.central.api_url);
      CoreConfigService.setEnvVariable('CENTRAL_FRONT_URL', privateJson.central.front_url);
      CoreConfigService.setEnvVariable('HUB_FRONT_URL', privateJson.hub.front_url);
      CoreConfigService.setEnvVariable('GWS_CORE_PROD_DB_PASSWORD', privateJson.db.gws_core_prod_password);
      CoreConfigService.setEnvVariable('GWS_CORE_DEV_DB_PASSWORD', privateJson.db.gws_core_dev_password);

      const isGpu: boolean = await this.isGpu();
      CoreConfigService.setEnvVariable('GPU', isGpu ? 'cuda' : '');
      // set the IMAGE_SUFFIX to use the correct image based on if GPU is on
      CoreConfigService.setEnvVariable('IMAGE_SUFFIX', isGpu ? 'gpu' : 'cpu');

      // FRONT VERSION
      CoreConfigService.setEnvVariable('FRONT_VERSION', configJson.front_version);

      // GLAB TAG
      CoreConfigService.setEnvVariable('GLAB_TAG', configJson.glab_tag);

      if (privateJson.lab.token == null) {
        throw new BadRequestException('Lab token is not set in the private file');
      }
      // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
      const hash = hashSync(privateJson.lab.token, 10);
      CoreConfigService.setEnvVariable('HT_PASSWD', `${privateJson.lab.username}:${hash}`);
      
      this.taskService.markTaskAsSuccess(taskName, 'Env variables set');
    }
    catch (error) {
      this.taskService.markTaskAsError(taskName, `Error while setting env variables: ${error.message}`);
      throw error;
    }
  }

  private async isGpu(): Promise<boolean> {
    try {
      // to check if this is a GPU server, check if nvidia is installed
      const nvidia = await this.commandService.execCommand('lspci | grep -i nvidia');
      return nvidia != '';
    } catch (_) {
      return false;
    }
  }
}
