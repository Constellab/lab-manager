import { Controller, Get, Param, Put, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { DockerContainerService } from './container/docker-container.service';
import { DockerLogs, DockerPsFull } from './docker.class';

/**
 * Controller to manage the main Docker Compose operations
 */
@Controller('docker-containers')
export class DockerContainersController {
  constructor(private readonly dockerContainerService: DockerContainerService) {}

  @Get(':containerName')
  getContainersDetail(@Param('containerName') containerName: string): Promise<DockerPsFull> {
    return this.dockerContainerService.getContainerDetail(containerName);
  }

  @Get(':containerName/size')
  async getContainerSize(@Param('containerName') containerName: string): Promise<{ size: string }> {
    const size = await this.dockerContainerService.getContainerSize(containerName);
    return { size };
  }

  @Get(':containerName/logs')
  async getLogs(@Param('containerName') containerName: string): Promise<DockerLogs> {
    const logs = await this.dockerContainerService.getLogs(containerName);
    return { logs };
  }

  @Get(':containerName/logs/error')
  async getErrorLogs(@Param('containerName') containerName: string): Promise<DockerLogs> {
    const logs = await this.dockerContainerService.getErrorLogs(containerName);
    return { logs };
  }

  @Get(':containerName/logs/export')
  async exportLogsToFile(@Param('containerName') containerName: string): Promise<StreamableFile> {
    const filePath = await this.dockerContainerService.exportLogsToFile(
      containerName,
      '/tmp/logs_export.txt'
    );
    const fileStream = createReadStream(filePath);

    return new StreamableFile(fileStream);
  }

  @Put(':containerName/stop')
  stopContainer(@Param('containerName') containerName: string): Promise<void> {
    return this.dockerContainerService.stopContainer(containerName);
  }

  @Put(':containerName/delete')
  deleteContainer(@Param('containerName') containerName: string): Promise<void> {
    return this.dockerContainerService.deleteContainer(containerName);
  }
}
