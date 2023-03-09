import {Body, Controller, Get, Param, Post, Put} from '@nestjs/common';
import {BeforeDockerCommandOptions, DockerService} from './docker/docker.service';
import {ComposeRestartOptions, ComposeUpOptions, DockerPs} from './docker.class';
import {InitService} from './init/init.service';
import {TaskService} from '../core/services/task/task.service';
import {BiotaService} from './biota/biota.service';
import {LabInitConfig, LabStatus} from './lab.class';
import {LabService} from './lab.service';
import {ConfigFile} from '../core/models/config-file.class';
import {ConfigFileService} from './config-file/config-file.service';

const initAllBeforeDockerCommand: BeforeDockerCommandOptions = {
  dockerLogin: true,
  setEnvVariables: true,
  generateComposeFile: true,
};

@Controller('lab')
export class LabController {

  constructor(private dockerService: DockerService,
    private initService: InitService,
    private taskService: TaskService,
    private biotaService: BiotaService,
    private labService: LabService,
    private configFileService: ConfigFileService) {
  }

  @Get('containers')
  listContainers(): Promise<DockerPs[]> {
    return this.dockerService.listContainers();
  }

  @Post('init-all')
  initAll(@Body() labInitConfig: LabInitConfig): Promise<void> {
    return this.initService.initAll(labInitConfig);
  }

  @Get('status')
  getStatus(): Promise<LabStatus> {
    return this.labService.getStatus();
  }

  @Post('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return await this.dockerService.upContainers(options, initAllBeforeDockerCommand);
  }

  @Post('restart-containers')
  restartContainers(@Body() options: ComposeRestartOptions): Promise<void> {
    return this.dockerService.restartContainers(options, initAllBeforeDockerCommand);
  }

  // TODO remove once all lab manager are v 1.0.1
  @Post('down-containers')
  downContainers(): Promise<void> {
    return this.dockerService.deleteContainers();
  }

  @Post('delete-containers')
  deleteContainers(): Promise<void> {
    return this.dockerService.deleteContainers();
  }

  @Post('pull-containers')
  pullContainers(): Promise<void> {
    return this.dockerService.pullContainers(initAllBeforeDockerCommand);
  }

  @Get(':containerName/logs')
  getLogs(@Param('containerName') containerName: string): Promise<string> {
    return this.dockerService.getLogs(containerName);
  }

  @Post('pull-biota-db')
  async pullBiotaDb(): Promise<void> {
    return this.biotaService.pullBiota();
  }

  @Post('registry-login')
  async registryLogin(): Promise<void> {
    return this.dockerService.login();
  }

  @Post('system-prune')
  async systemPrune(): Promise<void> {
    return this.dockerService.systemPrune();
  }

  @Post('stop-current-task')
  async stopCurrentTask(): Promise<void> {
    return this.taskService.forceStopCurrentTask();
  }

  @Get('config')
  getConfig(): ConfigFile {
    return this.configFileService.getLabConfig();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: ConfigFile): void {
    this.configFileService.updateConfig(updateConfig);
  }

  @Put('adminer/start')
  startAdminer(): Promise<boolean> {
    return this.dockerService.startAdminerService();
  }

  @Put('adminer/stop')
  stopAdminer(): Promise<boolean> {
    return this.dockerService.stopAdminerService();
  }
}
