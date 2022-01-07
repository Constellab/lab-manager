import {Body, Controller, Get, Param, Post} from '@nestjs/common';
import {DockerService} from './docker/docker.service';
import {ComposeUpOptions, DockerPs} from './docker.class';
import {InitService} from './init/init.service';
import {TaskService} from '../core/services/task/task.service';
import {BiotaService} from '../core/services/biota/biota.service';
import {LabInitConfig, LabStatus} from './lab.class';
import {LabService} from './lab.service';

@Controller('lab')
export class LabController {

  constructor(private dockerService: DockerService,
    private initService: InitService,
    private taskService: TaskService,
    private biotaService: BiotaService,
    private labService: LabService) {
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

  @Post('stop-current-task')
  async stopCurrentTask(): Promise<void> {
    return this.taskService.forceStopCurrentTask();
  }
}
