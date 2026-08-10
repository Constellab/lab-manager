import { Controller, Get, Param, Put, Query, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { DockerContainerService } from './container/docker-container.service';
import { LogSearchQueryParams, LogSearchResult } from './container/log-search.dto';
import { DockerLogs, DockerPsFull } from './docker.class';
import { LogSearchQueryPipe } from './pipes/log-search-query.pipe';

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

  /**
   * Filtered read of the logs, for a machine client that must not receive the whole blob.
   * A route of its own : an older lab manager answers 404, which is a signal the caller can branch
   * on, where unknown query parameters on `/logs` would have been silently ignored.
   */
  @Get(':containerName/logs/search')
  searchLogs(
    @Param('containerName') containerName: string,
    @Query(LogSearchQueryPipe) params: LogSearchQueryParams
  ): Promise<LogSearchResult> {
    return this.dockerContainerService.searchLogs(containerName, params);
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

  @Put(':containerName/start')
  startContainer(@Param('containerName') containerName: string): Promise<void> {
    return this.dockerContainerService.startContainer(containerName);
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
