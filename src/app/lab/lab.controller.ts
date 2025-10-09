import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { BrickConfigsDTO, ConfigFile, LabManagerCleanDTO } from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { UpdateLabManagerCommand } from '../core/services/external/external-space.class';
import { ErrorLogs, PullBiotaDbOptions } from '../docker/docker.class';
import { LabInitConfig, LabManagerStatus } from './lab.class';
import { LabService } from './lab.service';

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

  @Post('stop')
  stopLab(): Promise<void> {
    return this.labService.stopLabAsync();
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

  ///////////////////////// DESKTOP /////////////////////////

  @Get('desktop/update-lab-manager-command')
  async getUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    return this.labService.getDesktopUpdateLabManagerCommand();
  }

  ///////////////////////// SYSTEM /////////////////////////
  @Post('system/clean')
  async cleanLabManager(@Body() requestDTO: LabManagerCleanDTO): Promise<void> {
    return this.labService.cleanLabManager(requestDTO);
  }
}
