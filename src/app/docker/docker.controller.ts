import {Body, Controller, Get, Param, Post, Put} from '@nestjs/common';
import {ContainerStatusInfo, DockerService} from './docker/docker.service';
import {ComposeUpOptions, DockerPs} from './docker.class';
import {InitService} from './init/init.service';
import {TaskService} from '../core/services/task/task.service';
import {TaskStatusInfo} from '../core/models/task.class';

@Controller('docker')
export class DockerController {

  constructor(private dockerService: DockerService,
    private initService: InitService,
    private taskService: TaskService) {
  }

  @Get('containers')
  async listContainers(): Promise<DockerPs[]> {
    return await this.dockerService.listContainers();
  }

  @Post('init')
  async init(): Promise<void> {
    return await this.initService.init();
  }

  @Get('task')
  getTask(): TaskStatusInfo {
    return this.taskService.currentTask;
  }

  @Get('containers-status')
  async getContainersStatus(): Promise<ContainerStatusInfo> {
    return this.dockerService.getContainersStatus();
  }

  @Put('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<DockerPs[]> {
    return await this.dockerService.upContainers(options);
  }

  @Put('restart-containers')
  async restartContainers(@Body() options: ComposeUpOptions): Promise<void> {
    return await this.dockerService.restartContainers(options);
  }

  @Put('stop-containers')
  async stopContainers(): Promise<void> {
    return await this.dockerService.downContainers();
  }

  @Get(':containerName/logs')
  async getLogs(@Param('containerName') containerName: string): Promise<string> {
    return await this.dockerService.getLogs(containerName);
  }
}
