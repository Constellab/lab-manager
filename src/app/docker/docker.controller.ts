import {Body, Controller, Get, Param, Put} from '@nestjs/common';
import {DockerService} from './docker/docker.service';
import {ComposeUpOptions, DockerPs} from './docker.class';

@Controller('docker')
export class DockerController {

  constructor(private dockerService: DockerService) {
  }

  @Get('containers')
  async listContainers(): Promise<DockerPs[]> {
    return await this.dockerService.listContainers();
  }

  @Put('up-containers')
  async upContainers(@Body() options: ComposeUpOptions): Promise<void> {
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
