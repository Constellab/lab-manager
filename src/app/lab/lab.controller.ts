import { Body, Controller, Get, Param, Post, Put, StreamableFile } from '@nestjs/common';
import { ComposeRestartOptions, ComposeUpOptions, DockerPs, DockerPsFull, PullBiotaDbOptions } from '../docker/docker.class';
import { LabInitConfig, LabStatus } from './lab.class';
import { LabService } from './lab.service';
import { ConfigFile } from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { createReadStream } from 'fs';

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

  @Post('init-all')
  initAll(@Body() labInitConfig: LabInitConfig): void {
    this.labService.initLab(labInitConfig);
  }

  @Post('configure-lab-manager')
  configureLabManager(@Body() labInitConfig: LabInitConfig): Promise<void> {
    return this.labService.configureLabManager(labInitConfig);
  }

  @Post('pull-biota-db')
  async pullBiotaDb(@Body() labInitConfig: PullBiotaDbOptions = {}): Promise<void> {
    return this.labService.pullBiotaDb(labInitConfig);
  }


  @Get('config')
  getConfig(): ConfigFile {
    return this.labService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: ConfigFile): void {
    this.labService.updateConfig(updateConfig);
  }

  ///////////////////////// CONTAINER /////////////////////////
  @Get('containers')
  listContainers(): Promise<DockerPs[]> {
    return this.labService.listContainers();
  }
  
  @Get('containers/:containerName')
  getContainersDetail(@Param('containerName') containerName: string): Promise<DockerPsFull> {
    return this.labService.getContainerDetail(containerName);
  }

  @Get('containers/:containerName/size')
  async getContainerSize(@Param('containerName') containerName: string): Promise<{size: string}> {
    const size = await this.labService.getContainerSize(containerName);
    return {size};
  }

  @Get('containers/:containerName/logs')
  getLogs(@Param('containerName') containerName: string): Promise<string> {
    return this.labService.getLogs(containerName);
  }

  @Get('containers/:containerName/logs/export')
  async exportLogsToFile(@Param('containerName') containerName: string): Promise<StreamableFile> {
    const filePath = await this.labService.exportLogsToFile(containerName);
    const fileStream = createReadStream(filePath);

    return new StreamableFile(fileStream);
  }


  /**
   * Start a container service from docker-compose file
   * @param serviceName 
   * @returns 
   */
  @Put('containers/:serviceName/start')
  startComposeContainer(@Param('serviceName') serviceName: string): Promise<void> {
    return this.labService.startComposeContainer(serviceName);
  }

  @Put('containers/:containerName/stop')
  stopContainer(@Param('containerName') containerName: string): Promise<boolean> {
    return this.labService.stopContainer(containerName);
  }

  @Put('containers/:containerName/delete')
  deleteContainer(@Param('containerName') containerName: string): Promise<boolean> {
    return this.labService.deleteContainer(containerName);
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

  @Post('system-prune')
  async systemPrune(): Promise<void> {
    return this.labService.systemPrune();
  }

  ///////////////////////// ADMINER /////////////////////////
  @Put('adminer/start')
  startAdminer(): Promise<boolean> {
    return this.labService.startAdminer();
  }

  @Put('adminer/stop')
  stopAdminer(): Promise<boolean> {
    return this.labService.stopAdminer();
  }

}
