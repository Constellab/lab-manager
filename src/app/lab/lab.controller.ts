import { Body, Controller, Get, Param, Post, Put, StreamableFile } from '@nestjs/common';
import {
  ComposeRestartOptions,
  ComposeUpOptions,
  DockerInspect,
  DockerLogs,
  DockerPsFull,
  ErrorLogs,
  PullBiotaDbOptions,
} from '../docker/docker.class';
import { LabInitConfig, LabManagerStatus } from './lab.class';
import { LabService } from './lab.service';
import { BrickConfigsDTO, ConfigFile } from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { createReadStream } from 'fs';
import { AdminerInfo } from '../docker/container/container.class';
import { UpdateLabManagerCommand } from '../core/services/external/external-space.class';

@Controller('lab')
export class LabController {
  constructor(private labService: LabService) {}

  @Get('status')
  getStatus(): Promise<LabManagerStatus> {
    return this.labService.getStatus();
  }

  @Get('starting/error')
  getStartingError(): Promise<ErrorLogs> {
    return this.labService.getStartingLabError();
  }

  @Get('current-task')
  async getCurrentTask(): Promise<TaskStatusInfo | null> {
    return this.labService.getCurrentTask();
  }

  @Post('stop-current-task')
  async stopCurrentTask(): Promise<void> {
    return this.labService.stopCurrentTask();
  }

  /**
   * Route to configure the lab manager and initialize the lab
   * @param labInitConfig
   */
  @Post('init-all')
  initAll(@Body() labInitConfig: LabInitConfig): void {
    this.labService.configureAndInitLab(labInitConfig);
  }

  /**
   * Route to initialize the lab manager
   * This is called by the lab manager standalone app 
   * because it might not have the config file
   * @param labInitConfig
   */
  @Post('init')
  init(): void {
    this.labService.initLab();
  }

  /**
   * Route to fully configure the lab manager
   * Main configuration and docker configuration
   */
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

  @Get('bricks-config')
  getBrickConfig(): BrickConfigsDTO {
    return this.labService.getBricksConfig();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: ConfigFile): Promise<void> {
    return this.labService.updateConfig(updateConfig);
  }

  @Put('bricks-config')
  updateBrickConfig(@Body() updateConfig: BrickConfigsDTO): Promise<void> {
    return this.labService.updateBrickConfig(updateConfig);
  }

  ///////////////////////// CONTAINER /////////////////////////
  @Get('containers')
  listContainers(): Promise<DockerInspect[]> {
    return this.labService.listContainers();
  }

  @Get('containers/:containerName')
  getContainersDetail(@Param('containerName') containerName: string): Promise<DockerPsFull> {
    return this.labService.getContainerDetail(containerName);
  }

  @Get('containers/:containerName/size')
  async getContainerSize(@Param('containerName') containerName: string): Promise<{ size: string }> {
    const size = await this.labService.getContainerSize(containerName);
    return { size };
  }

  @Get('containers/:containerName/logs')
  async getLogs(@Param('containerName') containerName: string): Promise<DockerLogs> {
    const logs = await this.labService.getLogs(containerName);
    return { logs };
  }

  @Get('containers/:containerName/logs/error')
  async getErrorLogs(@Param('containerName') containerName: string): Promise<DockerLogs> {
    const logs = await this.labService.getErrorLogs(containerName);
    return { logs };
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

  @Get('adminer/info')
  getAdminerInfo(): Promise<AdminerInfo> {
    return this.labService.getAdminerInfo();
  }

  ///////////////////////// DESKTOP /////////////////////////

  @Get('desktop/update-lab-manager-command')
  async getUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    return this.labService.getDesktopUpdateLabManagerCommand();
  }
}
