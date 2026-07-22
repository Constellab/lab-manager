import { Injectable } from '@nestjs/common';
import { TaskService } from '../../core/services/task/task.service';
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

  public async deleteContainer(containerName: string): Promise<void> {
    await this.checkContainerExists(containerName);

    const taskName = `Delete service ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      await dockerCommand.dockerRmContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, String(e));
      throw e;
    }
  }

  public async startContainer(containerName: string): Promise<void> {
    await this.checkContainerExists(containerName);

    const taskName = `Start service ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      await dockerCommand.startContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, String(e));
      throw e;
    }
  }

  public async stopContainer(containerName: string): Promise<void> {
    await this.checkContainerExists(containerName);

    const taskName = `Stop service ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      await dockerCommand.stopContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
    } catch (e) {
      this.taskService.markTaskAsError(taskName, String(e));
      throw e;
    }
  }

  public async getLogs(containerName: string): Promise<string> {
    await this.checkContainerExists(containerName);
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getLogs(containerName);
  }

  public async getErrorLogs(containerName: string): Promise<string> {
    await this.checkContainerExists(containerName);
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getErrorLogs(containerName);
  }

  public async exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    await this.checkContainerExists(containerName);
    const dockerCommand = new DockerCommand();
    return dockerCommand.exportLogsToFile(containerName, filePath);
  }

  public async getContainerDetail(containerName: string): Promise<DockerPsFull> {
    await this.checkContainerExists(containerName);
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getContainerFullInfo(containerName);
  }

  public async getContainerSize(containerName: string): Promise<string> {
    await this.checkContainerExists(containerName);
    const dockerCommand = new DockerCommand();
    return dockerCommand.getContainerSize(containerName);
  }

  private async checkContainerExists(containerName: string): Promise<void> {
    const dockerCommand = new DockerCommand();
    const exists = await dockerCommand.containerExists(containerName);
    if (!exists) {
      throw new Error(`Container ${containerName} does not exist`);
    }
  }

  public async pruneUnusedImages(): Promise<void> {
    // in local mode, don't prune because it breaks the local docker environment
    if (this.configService.isLocal()) return;

    const taskName = 'Clean system';
    this.taskService.newTask(taskName);

    try {
      const dockerCommand = new DockerCommand();
      const result = await dockerCommand.pruneUnusedImages();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, String(e));
      throw e;
    }
  }
}
