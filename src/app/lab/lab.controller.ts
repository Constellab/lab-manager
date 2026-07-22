import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  BrickConfigsDTO,
  ConfigFile,
  CustomEnvVariablesDTO,
  LabManagerCleanDTO,
  McpConfigDTO,
} from '../core/models/config-file.class';
import { TaskStatusInfo } from '../core/models/task.class';
import { HnBrickInfoDTO } from '../core/services/external/external-community.class';
import { UpdateLabManagerCommand } from '../core/services/external/external-space.class';
import { ErrorLogs } from '../docker/docker.class';
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

  @Get('config')
  getConfig(): ConfigFile {
    return this.labService.getConfig();
  }

  @Get('bricks-config')
  getBrickConfig(): BrickConfigsDTO {
    return this.labService.getBricksConfig();
  }

  /**
   * Like bricks-config, but enriches the current bricks with community info
   * (latest version, whether a newer version exists, description, image, ...)
   * by calling the community 'info' route.
   */
  @Get('bricks-info')
  getBrickInfo(): Promise<HnBrickInfoDTO[]> {
    return this.labService.getBricksInfo();
  }

  @Put('config')
  updateConfig(@Body() updateConfig: ConfigFile): Promise<void> {
    return this.labService.updateConfig(updateConfig);
  }

  @Put('bricks-config')
  updateBrickConfig(@Body() updateConfig: BrickConfigsDTO): Promise<void> {
    return this.labService.updateBrickConfig(updateConfig);
  }

  ///////////////////////// MCP / CUSTOM ENV /////////////////////////

  @Get('mcp-config')
  getMcpConfig(): McpConfigDTO {
    return this.labService.getMcpConfig();
  }

  @Put('mcp-config')
  setMcpConfig(@Body() body: McpConfigDTO): Promise<void> {
    return this.labService.setMcpConfig(body.enabled);
  }

  @Get('custom-env-variable')
  getCustomEnvVariables(): CustomEnvVariablesDTO {
    return this.labService.getCustomEnvVariables();
  }

  @Put('custom-env-variable')
  setCustomEnvVariables(@Body() body: CustomEnvVariablesDTO): Promise<void> {
    return this.labService.setCustomEnvVariables(body.variables);
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
