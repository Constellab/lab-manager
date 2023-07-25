import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ComposeRestartOptions, ComposeUpOptions, DockerPsFull, PullBiotaDbOptions } from './docker.class';
import { LabInitConfig, LabStatus } from './lab.class';
import { LabService } from './lab.service';
import { ConfigFile } from '../core/models/config-file.class';

@Controller('lab')
export class LabController {

  constructor(private labService: LabService) {
  }

  @Get('status')
  getStatus(): Promise<LabStatus> {
    return this.labService.getStatus();
  }

  @Post('stop-current-task')
  async stopCurrentTask(): Promise<void> {
    return this.labService.stopCurrentTask();
  }

  @Get('containers')
  listContainers(): Promise<DockerPsFull[]> {
    return this.labService.listContainers();
  }

  @Post('init-all')
  initAll(@Body() labInitConfig: LabInitConfig): void {
    this.labService.initLab(labInitConfig);
  }


  @Post('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return await this.labService.upContainers(options);
  }

  @Post('restart-containers')
  restartContainers(@Body() options: ComposeRestartOptions): Promise<void> {
    return this.labService.restartContainers(options);
  }

  @Post('delete-containers')
  deleteContainers(): Promise<void> {
    return this.labService.deleteContainers();
  }

  @Post('pull-containers')
  pullContainers(): Promise<void> {
    return this.labService.pullContainers();
  }

  @Get(':containerName/logs')
  getLogs(@Param('containerName') containerName: string): Promise<string> {
    return this.labService.getLogs(containerName);
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
