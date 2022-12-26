import {Injectable, Logger} from '@nestjs/common';
import {ConfigFile} from '../../core/models/config-file.class';
import {PrivateFile} from '../../core/models/private-file.class';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {hashSync} from 'bcrypt';
import {FileService} from '../../core/services/file/file.service';
import {CommandService} from '../../core/services/command/command.service';
import {ConfigFileService} from '../config-file/config-file.service';

@Injectable()
export class EnvVariableService {

  private readonly logger = new Logger(EnvVariableService.name);

  constructor(private configService: CoreConfigService,
    private fileService: FileService,
    private configFileService: ConfigFileService,
    private commandService: CommandService) {
  }

  /**
   * Set all the env variable necessary for the docker-compose file
   */
  public async setEnvVariables(): Promise<void> {
    this.logger.log('Initializing env variable');
    const configJson: ConfigFile = this.configFileService.readConfigFile();
    const privateJson: PrivateFile = this.fileService.readPrivateFile();

    CoreConfigService.setEnvVariable('APP_DIR', configJson.app_dir);
    if (configJson.labId != null) {
      CoreConfigService.setEnvVariable('LAB_ID', configJson.labId);
    }
    CoreConfigService.setEnvVariable('LAB_NAME', configJson.name);
    CoreConfigService.setEnvVariable('LAB_TOKEN', privateJson.lab.token);

    CoreConfigService.setEnvVariable('CENTRAL_API_KEY', privateJson.central.api_key);
    CoreConfigService.setEnvVariable('CENTRAL_API_URL', privateJson.central.api_url);
    CoreConfigService.setEnvVariable('CENTRAL_FRONT_URL', privateJson.central.front_url);
    CoreConfigService.setEnvVariable('HUB_FRONT_URL', privateJson.hub.front_url);

    const isGpu: boolean = await this.isGpu();
    CoreConfigService.setEnvVariable('GPU', isGpu ? 'cuda' : '');
    // set the IMAGE_SUFFIX to use the correct image based on if GPU is on
    CoreConfigService.setEnvVariable('IMAGE_SUFFIX', isGpu ? 'gpu' : 'cpu');

    // FRONT VERSION
    CoreConfigService.setEnvVariable('FRONT_VERSION', configJson.front_version);

    // GLAB TAG
    CoreConfigService.setEnvVariable('GLAB_TAG', configJson.glab_tag);

    // Data urls
    CoreConfigService.setEnvVariable('BIOTA_MARIA_DB_URL', configJson.biota_maria_db_url);
    CoreConfigService.setEnvVariable('BIOTA_SQLITE3_DB_URL', privateJson.db.gws_biota_sqlite3db_url);
    CoreConfigService.setEnvVariable('OPENDATA_BIODATA_URL', privateJson.db.opendata_biodata_url);
    CoreConfigService.setEnvVariable('OPENDATA_GLOVE_URL', privateJson.db.opendata_glove_url);
    CoreConfigService.setEnvVariable('OPENDATA_URL', privateJson.db.opendata_url);
    CoreConfigService.setEnvVariable('TESTDATA_URL', privateJson.db.testdata_url);


    // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
    const hash = hashSync(privateJson.lab.token, 10);
    CoreConfigService.setEnvVariable('HT_PASSWD', `${privateJson.lab.username}:${hash}`);
    this.logger.log('Env variable initialized');
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
