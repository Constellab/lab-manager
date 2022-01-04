import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {CoreConfigService} from '../config/core-config.service';
import {FileService} from '../file/file.service';
import {PrivateFile} from '../../model/private-file.class';
import {KeyGeneratorService} from '../key-generator/key-generator.service';
import {ConfigFile} from '../../model/config-file.class';
import {hashSync} from 'bcrypt';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private fileService: FileService,
    private keyGenerator: KeyGeneratorService) {

  }


  onApplicationBootstrap(): void {
    if (!this.fileService.privateFileExists()) {
      this.generatePrivateFile();
    }

    if (!this.fileService.configFileExists()) {
      this.generateConfigFile();
    }
    this.generateDockerCompose();

    this.initEnvVariable();
  }

  private generatePrivateFile(): void {
    this.logger.log('Generating private.json file');
    const privateJson: PrivateFile = this.fileService.readPrivateTemplateFile();

    // configure central information a central api key
    if (privateJson.central.api_key == null) {
      privateJson.central.api_key = this.keyGenerator.generateRandomKey(96);
    }
    privateJson.central.api_url = this.configService.getCentralApiUrl();

    // generate the lab token
    if (privateJson.lab.token == null) {
      privateJson.lab.token = this.keyGenerator.generateRandomKey(96);
    }

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
    this.logger.log('Generating docker-compose.yml file');
    this.fileService.copyDockerCompose();
    this.logger.log('docker-compose.yml file generated');
  }

  private initEnvVariable(): void {
    this.logger.log('Initializing env variable');
    const configJson: ConfigFile = this.fileService.readConfigFile();
    const privateJson: PrivateFile = this.fileService.readPrivateFile();

    this.setEnvVariable('APP_DIR', configJson.app_dir);
    this.setEnvVariable('LAB_NAME', configJson.name);
    this.setEnvVariable('LAB_TOKEN', privateJson.lab.token);
    this.setEnvVariable('GPU', ''); // todo
    this.setEnvVariable('CENTRAL_API_KEY', privateJson.central.api_key);
    this.setEnvVariable('CENTRAL_API_URL', privateJson.central.api_url);
    // set the IMAGE_SUFFIX to use the correct image based on if GPU is on
    this.setEnvVariable('IMAGE_SUFFIX', this.configService.isGPU() ? 'gpu' : 'cpu');

    // Data urls
    this.setEnvVariable('BIOTA_MARIA_DB_URL', privateJson.db.gws_biota_mariadb_url);
    this.setEnvVariable('BIOTA_SQLITE3_DB_URL', privateJson.db.gws_biota_sqlite3db_url);
    this.setEnvVariable('OPENDATA_BIODATA_URL', privateJson.db.opendata_biodata_url);
    this.setEnvVariable('OPENDATA_GLOVE_URL', privateJson.db.opendata_glove_url);
    this.setEnvVariable('OPENDATA_URL', privateJson.db.opendata_url);
    this.setEnvVariable('TESTDATA_URL', privateJson.db.testdata_url);


    // Generate the htpasswd for the Lab token for CODELAB using Bcrypt
    const hash = hashSync(privateJson.lab.token, 10);
    this.setEnvVariable('HT_PASSWD', hash);
    this.logger.log('Env variable initialized');

  }

  private setEnvVariable(name: string, value: string): void {
    process.env[name] = value;
  }


}
