import { Injectable } from '@nestjs/common';
import { TaskService } from 'src/app/core/services/task/task.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { DockerCommand } from '../docker-command.class';
import { DockerPsFull } from '../docker.class';

/**
 * Service to manage individual docker containers
 */
@Injectable()
export class DockerContainerService {
  constructor(
    private taskService: TaskService,
    private configService: CoreConfigService
  ) {}

  public async containerExists(containerName: string): Promise<boolean> {
    const dockerCommand = new DockerCommand();
    const container = await dockerCommand.dockerInspect(containerName);
    return container.exists();
  }

  public async deleteContainer(containerName: string): Promise<boolean> {
    // return false if the container is not running
    const dockerCommand = new DockerCommand();
    const container = await dockerCommand.dockerInspect(containerName);
    if (!container.exists()) return false;

    const taskName = `Delete service ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      await dockerCommand.dockerRmContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopContainer(containerName: string): Promise<boolean> {
    // return false if the container is not running
    if (!(await this.containerExists(containerName))) return false;

    const taskName = `Stop service ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      await dockerCommand.stopContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async getLogs(containerName: string): Promise<string> {
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getLogs(containerName);
  }

  public async getErrorLogs(containerName: string): Promise<string> {
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getErrorLogs(containerName);
  }

  public exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    const dockerCommand = new DockerCommand();
    return dockerCommand.exportLogsToFile(containerName, filePath);
  }

  public async getContainerDetail(containerName: string): Promise<DockerPsFull> {
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getContainerFullInfo(containerName);
  }

  public getContainerSize(containerName: string): Promise<string> {
    const dockerCommand = new DockerCommand();
    return dockerCommand.getContainerSize(containerName);
  }

  public async systemPrune(): Promise<void> {
    // in local mode, don't prune because it breaks the local docker environment
    if (this.configService.isLocal()) return;

    const taskName = 'Clean system';
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      const result = await dockerCommand.systemPrune();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }
}
