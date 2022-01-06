import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {FileService} from '../../core/services/file/file.service';
import {PrivateFile} from '../../core/models/private-file.class';
import {KeyGeneratorService} from '../../core/services/key-generator/key-generator.service';
import {ConfigFile} from '../../core/models/config-file.class';
import {hashSync} from 'bcrypt';
import {DockerService} from '../docker/docker.service';
import {BiotaService} from '../../core/services/biota/biota.service';
import {join} from 'path';

@Injectable()
export class InitService implements OnApplicationBootstrap {

  private readonly logger = new Logger(InitService.name);

  constructor(private configService: CoreConfigService,
    private fileService: FileService,
    private keyGenerator: KeyGeneratorService,
    private dockerService: DockerService,
    private biotaService: BiotaService) {
  }

  onApplicationBootstrap(): any {
  }

  public async initAll(): Promise<void> {
    try {
      this.logger.log('[INIT] Init started');

      this.initAppVolume();

      this.generateFiles();
      this.initEnvVariable();

      await this.loginToDockerRegistry();

      // PULL BIOTA DB
      await this.biotaService.pullBiota();

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

  private generateFiles(): void {
    if (!this.fileService.privateFileExists()) {
      this.generatePrivateFile();
    }

    if (!this.fileService.configFileExists()) {
      this.generateConfigFile();
    }
    this.generateDockerCompose();
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
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    this.fileService.copyDockerCompose();
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private initEnvVariable(): void {
    this.logger.log('Initializing env variable');
    const configJson: ConfigFile = this.fileService.readConfigFile();
    const privateJson: PrivateFile = this.fileService.readPrivateFile();

    CoreConfigService.setEnvVariable('APP_DIR', configJson.app_dir);
    CoreConfigService.setEnvVariable('LAB_NAME', configJson.name);
    CoreConfigService.setEnvVariable('LAB_TOKEN', privateJson.lab.token);
    CoreConfigService.setEnvVariable('GPU', ''); // todo
    CoreConfigService.setEnvVariable('CENTRAL_API_KEY', privateJson.central.api_key);
    CoreConfigService.setEnvVariable('CENTRAL_API_URL', privateJson.central.api_url);
    // set the IMAGE_SUFFIX to use the correct image based on if GPU is on
    CoreConfigService.setEnvVariable('IMAGE_SUFFIX', this.configService.isGPU() ? 'gpu' : 'cpu');

    // Data urls
    CoreConfigService.setEnvVariable('BIOTA_MARIA_DB_URL', privateJson.db.gws_biota_mariadb_url);
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

  private async loginToDockerRegistry(): Promise<void> {
    try {
      await this.dockerService.login();
    } catch (e: any) {
    }
  }
}
