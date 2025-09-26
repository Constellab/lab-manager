import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrickConfigsDTO, ConfigFile } from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { ConfigFileService } from '../core/services/config-file/config-file.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { ExternalCommunityApiService } from '../core/services/external/external-community-api.service';
import { BrickGWS, BrickGWSTechnicalInfo } from '../core/services/external/external-community.class';
import { ExternalLabApiService } from '../core/services/external/external-lab-api.service';
import { ExternalSpaceApiService } from '../core/services/external/external-space-api.service';
import { UpdateLabManagerCommand } from '../core/services/external/external-space.class';
import { FileService } from '../core/services/file/file.service';
import { TaskService } from '../core/services/task/task.service';
import { AdminerComposeService } from '../docker/adminer/adminer-compose.service';
import { AdminerInfo } from '../docker/adminer/adminer.class';
import { BeforeDockerCommandOptions, MainComposeService } from '../docker/compose/main-compose.service';
import { MainComposeServiceName } from '../docker/compose/main-docker-compose.class';
import { DockerContainerService } from '../docker/container/docker-container.service';
import {
  ComposeRestartOptions,
  ComposeUpOptions,
  DockerInspect,
  DockerPsFull,
  ErrorLogs,
  PullBiotaDbOptions,
} from '../docker/docker.class';
import { BiotaService } from './biota/biota.service';
import { EnvVariableService } from './env-variable/env-variable.service';
import { InitService } from './init/init.service';
import { LabInitConfig, LabManagerStatus, LabStatus } from './lab.class';

const initAllBeforeDockerCommand: BeforeDockerCommandOptions = {
  generateComposeFile: true,
};

@Injectable()
export class LabService implements OnModuleInit {
  private readonly logger = new Logger(LabService.name);

  constructor(
    private mainComposeService: MainComposeService,
    private taskService: TaskService,
    private coreConfigService: CoreConfigService,
    private dockerContainerService: DockerContainerService,
    private fileService: FileService,
    private configFileService: ConfigFileService,
    private biotaService: BiotaService,
    private initService: InitService,
    private envVariableService: EnvVariableService,
    private communityService: ExternalCommunityApiService,
    private externalLabService: ExternalLabApiService,
    private spaceService: ExternalSpaceApiService,
    private adminerService: AdminerComposeService
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Checking if we auto start the lab');
    if (!this.coreConfigService.getAutoStartLab()) {
      this.logger.log('Auto start lab is disabled');
      return;
    }
    try {
      const status = await this.getStatus();
      const statuses: LabStatus[] = ['ERROR', 'STOPPED'];
      if (status.isInitialized && status.isConfigured && statuses.includes(status.labStatus)) {
        this.logger.log('Auto starting the lab');
        this.initLab();
      } else {
        this.logger.log('Lab is already running or not configured, skipping auto start');
      }
    } catch (e) {
      this.logger.error('Error while initializing the lab service', e);
    }
  }

  public async getStatus(): Promise<LabManagerStatus> {
    let lastInitManagerVersion: string = null;
    if (this.fileService.privateFileExists()) {
      lastInitManagerVersion = this.fileService.readPrivateFile().data?.last_init_manager_version ?? null;
    }

    const containers = await this.mainComposeService.inspectContainers();
    const containersStatus = containers.getStatus();

    const labIsRunning = await this.externalLabService.healthCheck();

    let labStatus: LabStatus = 'STOPPED';
    if (labIsRunning) {
      labStatus = 'RUNNING';
      // if all the containers are up, but lab not accessible, we consider the lab is starting
    } else if (containersStatus.status === 'UP') {
      labStatus = 'STARTING';
    } else if (containersStatus.status === 'ERROR') {
      labStatus = 'ERROR';
    } else if (
      containersStatus.status === 'PARTIALLY_UP' ||
      containersStatus.status === 'DOWN' ||
      containersStatus.status === 'STOP'
    ) {
      labStatus = 'STOPPED';
    }

    const glabStartLog = this.fileService.readLogStartFileIfExists('prod');

    return {
      containersStatus: containersStatus,
      currentTask: this.taskService.currentTask,
      adminerIsRunning: await this.adminerService.adminerIsRunning(),
      version: this.coreConfigService.getLabManagerVersion(),
      biota: {
        exists: this.biotaService.biotaDbExists(),
        dbUrl: this.biotaService.getCurrentVersionUrl(),
      },
      isConfigured: this.configFileService.configFileExists(),
      isInitialized: this.fileService.privateFileExists(),
      lastInitVersion: lastInitManagerVersion,
      labFrontUrl: this.getLabFrontUrl(),
      labStatus: labStatus,
      glabStatus: {
        status: containers.getContainer(MainComposeServiceName.GLAB)?.status ?? 'none',
        startProgress: glabStartLog?.progress,
        hasStartError: glabStartLog?.errors?.length > 0,
      },
    };
  }

  public async getStartingLabError(): Promise<ErrorLogs> {
    return await this.mainComposeService.getGlabStartErrorLogs('prod');
  }

  public getLabFrontUrl(): string {
    if (this.coreConfigService.isLocal()) {
      return 'http://localhost:89';
    }
    return `https://lab.${this.coreConfigService.getVirtualHost()}`;
  }

  public configureAndInitLab(labInitConfig: LabInitConfig): void {
    this.checkInitConfig(labInitConfig);

    this.initService.configureAndInitLab(labInitConfig).catch((err) => {
      this.logger.error(err);
    });
  }

  public initLab(): void {
    this.initService.initLab().catch((err) => {
      this.logger.error(err);
    });
  }

  public async configureLabManager(labInitConfig: LabInitConfig): Promise<void> {
    this.checkInitConfig(labInitConfig);
    this.initService.configureLabManager(labInitConfig);

    if (this.configFileService.configFileExists()) {
      await this.initService.configureDockerCompose();
    }
  }

  private checkInitConfig(labInitConfig: LabInitConfig): void {
    if (
      !labInitConfig.space ||
      !labInitConfig.community ||
      !labInitConfig.gwsCoreProdPassword ||
      !labInitConfig.gwsCoreDevPassword ||
      !labInitConfig.labConfig
    ) {
      throw new BadRequestException('The provided configuration is missing some required fields');
    }
  }

  public getCurrentTask(): TaskStatusInfo | null {
    return this.taskService.currentTask;
  }

  public stopCurrentTask(): void {
    this.taskService.forceStopCurrentTask();
  }

  private async checkLabIsConfigured(): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException(
        'The lab bricks are not configured. Please configure the lab before calling this method'
      );
    }

    if (!this.fileService.privateFileExists()) {
      throw new BadRequestException(
        'The lab is not initialized. Please initialize the lab before calling this method'
      );
    }

    if (!this.fileService.exists(this.fileService.dockerComposePath)) {
      throw new BadRequestException(
        'The docker compose file was not generated. Please initialize the lab before calling this method'
      );
    }

    if (!this.fileService.exists(this.fileService.envFilePath)) {
      throw new BadRequestException(
        'The env file was not generated. Please initialize the lab before calling this method'
      );
    }
  }

  //////////////////////////// CONTAINERS ////////////////////////////

  public async listContainers(): Promise<DockerInspect[]> {
    const containers = await this.mainComposeService.inspectContainers();
    return containers.getContainers();
  }

  public async getContainerDetail(containerName: string): Promise<DockerPsFull> {
    return this.mainComposeService.getContainersDetail(containerName);
  }

  public async getContainerSize(containerName: string): Promise<string> {
    return this.mainComposeService.getContainerSize(containerName);
  }

  public async startComposeContainer(serviceName: string): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.upContainerCommand([serviceName]);
  }

  public async stopContainer(containerName: string): Promise<boolean> {
    await this.checkLabIsConfigured();
    return this.dockerContainerService.stopContainer(containerName);
  }

  public async deleteContainer(containerName: string): Promise<boolean> {
    await this.checkLabIsConfigured();
    return this.dockerContainerService.deleteContainer(containerName);
  }

  public async upContainers(options: ComposeUpOptions): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.upContainers(options, initAllBeforeDockerCommand);
  }

  public async restartContainers(options: ComposeRestartOptions): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.restartContainers(options, initAllBeforeDockerCommand);
  }

  public async stopContainers(): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.stopContainers();
  }

  public async deleteContainers(): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.deleteContainers();
  }

  public async pullContainers(): Promise<void> {
    await this.checkLabIsConfigured();
    return this.mainComposeService.pullContainers(initAllBeforeDockerCommand);
  }

  public async getLogs(containerName: string): Promise<string> {
    return this.dockerContainerService.getLogs(containerName);
  }

  public async getErrorLogs(containerName: string): Promise<string> {
    return this.dockerContainerService.getErrorLogs(containerName);
  }

  public exportLogsToFile(containerName: string): Promise<string> {
    return this.dockerContainerService.exportLogsToFile(containerName, '/tmp/logs_export.txt');
  }

  public async systemPrune(): Promise<void> {
    return this.mainComposeService.systemPrune();
  }

  //////////////////////////// BIOTA ////////////////////////////

  public async pullBiotaDb(options: PullBiotaDbOptions = {}): Promise<void> {
    await this.checkLabIsConfigured();
    return this.biotaService.pullBiota(options.forceUpdate, true);
  }

  //////////////////////////// CONFIG ////////////////////////////
  public getConfig(): ConfigFile {
    return this.configFileService.getConfig();
  }

  public getBricksConfig(): BrickConfigsDTO {
    const configFile = this.getConfig();
    if (!configFile) {
      return {
        brickVersions: [],
      };
    }
    return {
      brickVersions: configFile.environment?.bricks ?? [],
    };
  }

  public async updateConfig(config: ConfigFile): Promise<void> {
    await this.configFileService.updateConfig(config);

    // if the private file exists, we update the env variables
    if (this.fileService.privateFileExists()) {
      this.envVariableService.setAllEnvVariables(config, this.fileService.readPrivateFile());
    }
  }

  public async updateBrickConfig(brickConfigs: BrickConfigsDTO): Promise<void> {
    // check if gws_core is in the bricks
    const gwsCore = brickConfigs.brickVersions.find((brick) => brick.name === BrickGWS.GWS_CORE);

    if (!gwsCore) {
      throw new BadRequestException('The brick gws_core is required in the bricks configuration');
    }

    const configFile: ConfigFile = {
      lab_id: null,
      name: null,
      front_version: null,
      glab_tag: null,
      environment: {
        bricks: brickConfigs.brickVersions.map((brick) => ({
          name: brick.name,
          version: brick.version,
        })),
        variables: {},
      },
      variables: {},
    };

    // get gws_core version info
    const brickInfo = await this.communityService.getBrickVersion(BrickGWS.GWS_CORE, gwsCore.version);

    // retrieve front version
    const frontVersion = brickInfo.technicalInfo[BrickGWSTechnicalInfo.GWS_CORE_FRONT_VERSION];
    if (frontVersion == null) {
      throw new BadRequestException('The front version is not set in the gws_core brick technical info');
    }
    configFile.front_version = frontVersion;

    // retrieve glab tag
    const glabTag = brickInfo.technicalInfo[BrickGWSTechnicalInfo.GWS_CORE_GLAB_VERSION];
    if (glabTag == null) {
      throw new BadRequestException(
        'The glab tag is not set in the config file and could not be found in the gws_core' +
          ' brick technical info'
      );
    }

    configFile.glab_tag = glabTag;

    // if biota is in the bricks, we add the db url
    const biota = brickConfigs.brickVersions.find((brick) => brick.name === BrickGWS.GWS_BIOTA);

    if (biota) {
      const biotaInfo = await this.communityService.getBrickVersion(BrickGWS.GWS_BIOTA, biota.version);

      const dbUrl = biotaInfo.technicalInfo[BrickGWSTechnicalInfo.GWS_BIOTA_DB_URL];
      if (dbUrl == null) {
        throw new BadRequestException('The db url is not set in the gws_biota brick technical info');
      }

      configFile.biota_maria_db_url = dbUrl;
    }

    this.configFileService.updateConfig(configFile);
  }

  //////////////////////////// ADMINER ////////////////////////////
  public async startAdminer(): Promise<boolean> {
    return this.adminerService.startAdminerContainer();
  }

  public async stopAdminer(): Promise<boolean> {
    return this.adminerService.deleteAdminerContainer();
  }

  public async getAdminerInfo(): Promise<AdminerInfo> {
    return this.adminerService.getAdminerInfo();
  }

  //////////////////////////// DESKTOP ////////////////////////////

  public async getDesktopUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    if (!this.coreConfigService.isLocal()) {
      throw new BadRequestException('This method is only available in local mode');
    }

    return this.spaceService.getUpdateLabManagerCommand();
  }
}
