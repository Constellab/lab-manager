import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ComposeRestartOptions, ComposeUpOptions, DockerPs, DockerPsFull, PullBiotaDbOptions } from '../docker/docker.class';
import { LabInitConfig, LabStatus } from './lab.class';
import { LabService } from './lab.service';
import { ConfigFile } from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';

@Controller('lab')
export class LabController {

  constructor(private labService: LabService) {
  }

  @Get('status')
  getStatus(): Promise<LabStatus> {
    return this.labService.getStatus();
  }

  @Get('current-task')
  async getCurrentTask(): Promise<TaskStatusInfo | null> {
    return this.labService.getCurrentTask();
  }

  @Post('stop-current-task')
  async stopCurrentTask(): Promise<void> {
    return this.labService.stopCurrentTask();
  }

  @Get('containers')
  listContainers(): Promise<DockerPs[]> {
    return this.labService.listContainers();
  }
  
  @Get('containers/:containerName')
  getContainersDetail(@Param('containerName') containerName: string): Promise<DockerPsFull> {
    return this.labService.getContainerDetail(containerName);
  }

  @Get('containers/:containerName/logs')
  getLogs(@Param('containerName') containerName: string): Promise<string> {
    return this.labService.getLogs(containerName);
  }

  @Post('init-all')
  initAll(@Body() labInitConfig: LabInitConfig): void {
    this.labService.initLab(labInitConfig);
  }

  @Post('configure-lab-manager')
  configureLabManager(@Body() labInitConfig: LabInitConfig): Promise<void> {
    return this.labService.configureLabManager(labInitConfig);
  }


  @Post('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return await this.labService.upContainers(options);
  }

  @Post('restart-containers')
  restartContainers(@Body() options: ComposeRestartOptions): Promise<void> {
    return this.labService.restartContainers(options);
  }

  @Post('stop-containers')
  stopContainers(): Promise<void> {
    return this.labService.stopContainers();
  }

  @Post('delete-containers')
  deleteContainers(): Promise<void> {
    return this.labService.deleteContainers();
  }

  @Post('pull-containers')
  pullContainers(): Promise<void> {
    return this.labService.pullContainers();
  }

  @Post('pull-biota-db')
  async pullBiotaDb(@Body() labInitConfig: PullBiotaDbOptions = {}): Promise<void> {
    return this.labService.pullBiotaDb(labInitConfig);
  }

  @Post('registry-login')
  async registryLogin(): Promise<void> {
    return this.labService.registryLogin();
  }

  @Post('system-prune')
  async systemPrune(): Promise<void> {
    return this.labService.systemPrune();
  }

  @Get('config')
  getConfig(): ConfigFile {
    return this.labService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: ConfigFile): void {
    this.labService.updateConfig(updateConfig);
  }

  @Put('adminer/start')
  startAdminer(): Promise<boolean> {
    return this.labService.startAdminer();
  }

  @Put('adminer/stop')
  stopAdminer(): Promise<boolean> {
    return this.labService.stopAdminer();
  }
}
