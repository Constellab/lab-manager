import {Body, Controller, Get, Param, Post, Put} from '@nestjs/common';
import {DockerService} from './docker/docker.service';
import {ComposeUpOptions, DockerPs} from './docker.class';
import {InitService} from './init/init.service';
import {TaskService} from '../core/services/task/task.service';
import {BiotaService} from './biota/biota.service';
import {LabInitConfig, LabStatus} from './lab.class';
import {LabService} from './lab.service';
import {LabConfigDTO, UpdateConfigDTO} from '../core/models/config-file.class';
import {ConfigFileService} from './config-file/config-file.service';

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
  initAll(@Body() labInitConfig: LabInitConfig): void {
    this.initService.initAll(labInitConfig).then();
  }

  @Get('status')
  getCurrentTask(): Promise<LabStatus> {
    return this.labService.getStatus();
  }

  @Post('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return await this.dockerService.upContainers(options);
  }

  @Post('restart-containers')
  restartContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return this.dockerService.restartContainers(options);
  }

  @Post('down-containers')
  downContainers(): Promise<void> {
    return this.dockerService.downContainers();
  }

  @Post('pull-containers')
  pullContainers(): Promise<void> {
    return this.dockerService.pullContainers();
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
  getBricks(): LabConfigDTO {
    return this.configFileService.getLabConfig();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: UpdateConfigDTO): void {
    this.configFileService.updateConfig(updateConfig);
  }
}
