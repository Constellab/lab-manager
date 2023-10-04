import {BadRequestException, Injectable, Logger} from '@nestjs/common';
import {LabInitConfig, LabStatus} from './lab.class';
import {BeforeDockerCommandOptions, DockerService} from '../docker/docker.service';
import {TaskService} from '../core/services/task/task.service';
import {CoreConfigService} from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { ConfigFileService } from '../core/services/config-file/config-file.service';
import { BiotaService } from './biota/biota.service';
import { InitService } from './init/init.service';
import { ConfigFile } from '../core/models/config-file.class';
import { ComposeRestartOptions, ComposeUpOptions, DockerPsFull, PullBiotaDbOptions } from '../docker/docker.class';
import { EnvVariableService } from './env-variable/env-variable.service';
import { ContainerService } from '../docker/container/container.service';

const initAllBeforeDockerCommand: BeforeDockerCommandOptions = {
  dockerLogin: true,
  generateComposeFile: true,
};

@Injectable()
export class LabService {

  private readonly logger = new Logger(LabService.name);


  constructor(private dockerService: DockerService,
    private taskService: TaskService,
    private configService: CoreConfigService,
    private containerService: ContainerService,
    private fileService: FileService,
    private configFileService: ConfigFileService,
    private biotaService: BiotaService,
    private initService: InitService,
    private envVariableService: EnvVariableService) {
  }

  public async getStatus(): Promise<LabStatus> {
    let lastInitManagerVersion: string = null;
    if(this.fileService.privateFileExists()){
      lastInitManagerVersion = this.fileService.readPrivateFile().data?.last_init_manager_version ?? null;
    }

    return {
      containersStatus: await this.dockerService.getContainersStatus(),
      currentTask: this.taskService.currentTask,
      adminerIsRunning: await this.containerService.adminerIsRunning(),
      version: this.configService.getLabManagerVersion(),
      biota: {
        exists: this.biotaService.biotaDbExists(),
        dbUrl: this.biotaService.getCurrentVersionUrl(),
      },
      isConfigured: this.configFileService.configFileExists(),
      isInitialized: this.fileService.privateFileExists(),
      lastInitVersion: lastInitManagerVersion
    };
  }

  public initLab(labInitConfig: LabInitConfig): void {
    const currentTask = this.taskService.currentTask;
    if(currentTask && currentTask.status === 'RUNNING'){
      throw new BadRequestException(`The task ${currentTask.name} is running, please wait for this task to finish before running a new task`);
    }
    this.initService.initAll(labInitConfig).catch((err) => {
      this.logger.error(err);
    });
  }

  public stopCurrentTask(): void {
    this.taskService.forceStopCurrentTask();
  }

  private async checkLabIsConfigured(): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException('The lab bricks are not configured. Please configure the lab before calling this method');
    }

    if (!this.fileService.privateFileExists()) {
      throw new BadRequestException('The lab is not initialized. Please initialize the lab before calling this method');
    }

    if(!this.fileService.exists(this.fileService.dockerComposePath)){
      throw new BadRequestException('The docker compose file was not generated. Please initialize the lab before calling this method');
    }

    if(!this.fileService.exists(this.fileService.envFilePath)){
      throw new BadRequestException('The env file was not generated. Please initialize the lab before calling this method');
    }
  }

  //////////////////////////// CONTAINERS ////////////////////////////

  public async listContainers(): Promise<DockerPsFull[]> {
    return this.dockerService.listContainers();
  }

  public async upContainers(options: ComposeUpOptions): Promise<void> {
    await this.checkLabIsConfigured();
    return this.dockerService.upContainers(options, initAllBeforeDockerCommand);
  }


  public async restartContainers(options: ComposeRestartOptions): Promise<void> {
    await this.checkLabIsConfigured();
    return this.dockerService.restartContainers(options, initAllBeforeDockerCommand);
  }

  public async deleteContainers(): Promise<void> {
    await this.checkLabIsConfigured();
    return this.dockerService.deleteContainers();
  }

  public async pullContainers(): Promise<void> {
    await this.checkLabIsConfigured();
    return this.dockerService.pullContainers(initAllBeforeDockerCommand);
  }

  public async getLogs(containerName: string): Promise<string> {
    return this.dockerService.getLogs(containerName);
  }

  public async registryLogin(): Promise<void> {
    return this.dockerService.login();
  }

  public async systemPrune(): Promise<void> {
    return this.dockerService.systemPrune();
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

  public async updateConfig(config: ConfigFile): Promise<void> {
    await this.configFileService.updateConfig(config);

    // if the private file exists, we update the env variables
    if(this.fileService.privateFileExists()){
      this.envVariableService.setAllEnvVariables(config, this.fileService.readPrivateFile());
    }
  }

  //////////////////////////// ADMINER ////////////////////////////
  public async startAdminer(): Promise<boolean> {
    return this.containerService.startAdminerService();
  }

  public async stopAdminer(): Promise<boolean> {
    return this.containerService.deleteAdminerService();
  }
}
