import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BrickConfigsDTO,
  ConfigFile,
  CustomEnvVariablesDTO,
  LabManagerCleanDTO,
  McpConfigDTO,
  MCP_SERVER_ENABLED_KEY,
} from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { ConfigFileService } from '../core/services/config-file/config-file.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { ExternalCommunityApiService } from '../core/services/external/external-community-api.service';
import {
  BrickGWS,
  BrickGWSTechnicalInfo,
  HnBrickInfoDTO,
} from '../core/services/external/external-community.class';
import { ExternalLabApiService } from '../core/services/external/external-lab-api.service';
import { ExternalSpaceApiService } from '../core/services/external/external-space-api.service';
import { UpdateLabManagerCommand } from '../core/services/external/external-space.class';
import { FileService } from '../core/services/file/file.service';
import { TaskService } from '../core/services/task/task.service';
import { AdminerComposeService } from '../docker/adminer/adminer-compose.service';
import { DockerComposeAggregateService } from '../docker/compose/docker-compose-aggregate.service';
import { MainComposeService } from '../docker/compose/main-compose.service';
import { MainComposeServiceName } from '../docker/compose/main-docker-compose.class';
import { DockerContainerService } from '../docker/container/docker-container.service';
import { ErrorLogs } from '../docker/docker.class';
import { EnvVariableService } from './env-variable/env-variable.service';
import { InitService } from './init/init.service';
import { LabInitConfig, LabManagerStatus, LabStatus } from './lab.class';

@Injectable()
export class LabService implements OnModuleInit {
  private readonly logger = new Logger(LabService.name);

  constructor(
    private mainComposeService: MainComposeService,
    private taskService: TaskService,
    private coreConfigService: CoreConfigService,
    private fileService: FileService,
    private configFileService: ConfigFileService,
    private initService: InitService,
    private envVariableService: EnvVariableService,
    private communityService: ExternalCommunityApiService,
    private externalLabService: ExternalLabApiService,
    private spaceService: ExternalSpaceApiService,
    private adminerService: AdminerComposeService,
    private composeAggregateService: DockerComposeAggregateService,
    private dockerContainerService: DockerContainerService
  ) {}

  async onModuleInit(): Promise<void> {
    // If the manager was updated to a new version since the last lab start, the
    // lab needs a restart for the new version to take effect. Detect this once,
    // on manager startup, and persist it as the stored "needs restart" flag.
    this.detectManagerVersionChange();

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
    let lastInitManagerVersion: string | null = null;
    let needsRestart = false;
    if (this.fileService.privateFileExists()) {
      const privateFileData = this.fileService.readPrivateFile().data;
      lastInitManagerVersion = privateFileData?.lastInitManagerVersion ?? null;
      // "needs restart" is a stored flag: set to true when the config/env
      // variables change (LabService.updateConfig) or when the manager version
      // changed since the last start (LabService.detectManagerVersionChange),
      // and reset to false on the next lab start (InitService.init).
      needsRestart = privateFileData?.needsRestart ?? false;
    }

    const currentManagerVersion = this.coreConfigService.getLabManagerVersion();

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
      currentTask: this.taskService.currentTask ?? undefined,
      adminerIsRunning: await this.adminerService.adminerIsRunning(),
      version: currentManagerVersion,
      isConfigured: this.configFileService.configFileExists(),
      isInitialized: this.fileService.privateFileExists(),
      lastInitVersion: lastInitManagerVersion,
      needsRestart: needsRestart,
      labFrontUrl: this.getLabFrontUrl(),
      codelabFrontUrl: this.getCodeLabFrontUrl(),
      labStatus: labStatus,
      glabStatus: {
        status: containers.getContainer(MainComposeServiceName.GLAB)?.status ?? 'none',
        startProgress: glabStartLog?.progress ?? null,
        hasStartError: (glabStartLog?.main_errors?.length ?? 0) > 0,
      },
    };
  }

  /**
   * If the lab has already been initialized and the manager version stored at the
   * last lab start differs from the current version, mark the lab as needing a
   * restart. Called once on manager startup (onModuleInit). The flag is reset to
   * false on the next lab start (InitService.init).
   */
  private detectManagerVersionChange(): void {
    if (!this.fileService.privateFileExists()) {
      return;
    }

    const privateFileData = this.fileService.readPrivateFile().data;
    const lastInitManagerVersion = privateFileData?.lastInitManagerVersion ?? null;
    const currentManagerVersion = this.coreConfigService.getLabManagerVersion();

    if (lastInitManagerVersion != null && currentManagerVersion !== lastInitManagerVersion) {
      this.logger.log(
        `Lab manager version changed since last start (${lastInitManagerVersion} -> ` +
          `${currentManagerVersion}), marking the lab as needing a restart`
      );
      this.fileService.updatePrivateFileData({ needsRestart: true });
    }
  }

  public async getStartingLabError(): Promise<ErrorLogs | null> {
    return await this.mainComposeService.getGlabStartErrorLogs('prod');
  }

  public getLabFrontUrl(): string {
    if (this.coreConfigService.isLocal()) {
      return 'http://localhost:89';
    }
    return `https://lab.${this.coreConfigService.getVirtualHost()}`;
  }

  public getCodeLabFrontUrl(): string {
    if (this.coreConfigService.isLocal()) {
      return 'http://localhost:8083';
    }
    return `https://codelab.${this.coreConfigService.getVirtualHost()}`;
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

  public async stopLabAsync(): Promise<void> {
    const taskName = 'Stop lab';
    this.taskService.newTask(taskName);

    this.mainComposeService
      .stopServices()
      .then(() => {
        this.taskService.markTaskAsSuccess(taskName, 'Lab stopped successfully');
      })
      .catch((e) => {
        this.logger.error('Error while stopping the lab', e);
        this.taskService.markTaskAsError(taskName, e.toString());
      });

    // wait for 2 seconds before returning response
    // this is to prevent the 'Lab is starting' status to be shown
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
      !labInitConfig.db?.gwsCoreProdPassword ||
      !labInitConfig.db?.gwsCoreDevPassword ||
      !labInitConfig.lab ||
      !labInitConfig.backup
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

  //////////////////////////// CONFIG ////////////////////////////
  public getConfig(): ConfigFile | null {
    return this.configFileService.getConfig();
  }

  /**
   * Get the hash of the current config file.
   * Returns null if the config file does not exist.
   */
  public getConfigHash(): string | null {
    return this.configFileService.getConfigHash();
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

  /**
   * Like getBricksConfig, but enriches the current bricks with community info
   * (latest version, whether a newer version exists, description, image, ...)
   * by calling the community 'info' route with the current name/version pairs.
   */
  public getBricksInfo(): Promise<HnBrickInfoDTO[]> {
    const { brickVersions } = this.getBricksConfig();
    if (brickVersions.length === 0) {
      return Promise.resolve([]);
    }
    return this.communityService.getMultipleBrickInfo(
      brickVersions.map((brick) => ({ name: brick.name, version: brick.version }))
    );
  }

  public async updateConfig(config: ConfigFile): Promise<void> {
    // configFileService.updateConfig marks the lab as needing a restart (the
    // config changed). This is the single chokepoint every config write goes
    // through, including updateBrickConfig and the migrations run at init time.
    await this.configFileService.updateConfig(config);

    // if the private file exists, we update the env variables
    if (this.fileService.privateFileExists()) {
      await this.envVariableService.setAllEnvVariables(config, this.fileService.readPrivateFile());
    }
  }

  //////////////////////////// MCP CONFIG ////////////////////////////

  /**
   * Whether the MCP server is enabled on the lab. Reads the flag from the shared
   * custom-vars store (ConfigFile.variables); the value is a typed convenience over
   * the raw string gws_core parses. Takes effect only after a lab restart.
   */
  public getMcpConfig(): McpConfigDTO {
    const config = this.getConfig();
    return { enabled: config?.variables?.[MCP_SERVER_ENABLED_KEY] === 'true' };
  }

  /**
   * Enable/disable the MCP server. Persists the config and rewrites the env files
   * (no restart -- a separate restart applies it). Stored as the exact string
   * gws_core parses (=== 'true').
   */
  public async setMcpConfig(enabled: boolean): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      throw new BadRequestException('The lab is not configured yet.');
    }
    if (!config.variables) config.variables = {};
    config.variables[MCP_SERVER_ENABLED_KEY] = enabled ? 'true' : 'false';
    await this.updateConfig(config);
  }

  //////////////////////////// CUSTOM ENV VARIABLES ////////////////////////////

  /**
   * All custom, ops-set env vars (ConfigFile.variables), including
   * GWS_MCP_SERVER_ENABLED -- the MCP flag lives in the same store, getMcpConfig is
   * just a typed view of it.
   */
  public getCustomEnvVariables(): CustomEnvVariablesDTO {
    const config = this.getConfig();
    return { variables: config?.variables ?? {} };
  }

  /**
   * Replace the whole custom-env map with the given vars, then persist + rewrite the
   * env files (no restart). Replace-all (not merge) so a key the caller omits is
   * removed -- the editor UI owns this namespace and sends the full list.
   *
   * The MCP flag (MCP_SERVER_ENABLED_KEY) is the one exception: it lives in the same
   * map but is set via setMcpConfig, so it is preserved across a replace rather than
   * being wiped when the caller (which never sends it) omits it.
   */
  public async setCustomEnvVariables(vars: Record<string, string>): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      throw new BadRequestException('The lab is not configured yet.');
    }

    const preservedMcpValue = config.variables?.[MCP_SERVER_ENABLED_KEY];

    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      // Ignore the MCP key even if a caller sends it: it is owned by setMcpConfig.
      if (key === MCP_SERVER_ENABLED_KEY) continue;
      variables[key] = value;
    }
    if (preservedMcpValue !== undefined) {
      variables[MCP_SERVER_ENABLED_KEY] = preservedMcpValue;
    }

    config.variables = variables;
    await this.updateConfig(config);
  }

  public async updateBrickConfig(brickConfigs: BrickConfigsDTO): Promise<void> {
    // check if gws_core is in the bricks
    const gwsCore = brickConfigs.brickVersions.find((brick) => brick.name === BrickGWS.GWS_CORE);

    if (!gwsCore) {
      throw new BadRequestException('The brick gws_core is required in the bricks configuration');
    }

    // get gws_core version info
    const brickInfo = await this.communityService.getBrickVersion(BrickGWS.GWS_CORE, gwsCore.version);

    // retrieve front version
    const frontVersion = brickInfo.technicalInfo?.[BrickGWSTechnicalInfo.GWS_CORE_FRONT_VERSION];
    if (frontVersion == null) {
      throw new BadRequestException('The front version is not set in the gws_core brick technical info');
    }

    // retrieve glab tag
    const glabTag = brickInfo.technicalInfo?.[BrickGWSTechnicalInfo.GWS_CORE_GLAB_VERSION];
    if (glabTag == null) {
      throw new BadRequestException(
        'The glab tag is not set in the config file and could not be found in the gws_core' +
          ' brick technical info'
      );
    }

    const configFile: ConfigFile = {
      front_version: frontVersion,
      glab_tag: glabTag,
      environment: {
        bricks: brickConfigs.brickVersions.map((brick) => ({
          name: brick.name,
          version: brick.version,
        })),
        variables: {},
      },
      variables: {},
    };

    this.configFileService.updateConfig(configFile);
  }

  //////////////////////////// DESKTOP ////////////////////////////

  public async getDesktopUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    if (!this.coreConfigService.isLocal()) {
      throw new BadRequestException('This method is only available in local mode');
    }

    return this.spaceService.getUpdateLabManagerCommand();
  }

  //////////////////////////// SYSTEM ////////////////////////////

  public async cleanLabManager(requestDTO: LabManagerCleanDTO): Promise<void> {
    if (requestDTO.removeErrorSubComposes) {
      await this.composeAggregateService.removeErrorSubComposes();
    }
    if (requestDTO.pruneSystem) {
      await this.dockerContainerService.pruneUnusedImages();
    }
  }
}
