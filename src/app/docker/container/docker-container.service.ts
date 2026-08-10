import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TaskService } from '../../core/services/task/task.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { DockerCommand } from '../docker-command.class';
import { DockerPsFull } from '../docker.class';
import { LogSearchFilter } from './log-search-filter';
import { LOG_SEARCH_TIMEOUT_MS, LogSearchQueryParams, LogSearchResult } from './log-search.dto';

/** Charset docker accepts for a container name. */
const DOCKER_CONTAINER_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

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

  /**
   * Filtered read of the logs of a container, for a caller that cannot afford the whole blob.
   * The filtering runs here, where the data lives, and not on the caller side.
   */
  public async searchLogs(containerName: string, params: LogSearchQueryParams): Promise<LogSearchResult> {
    const dockerCommand = new DockerCommand();
    await this.checkContainerExistsOrNotFound(containerName, dockerCommand);

    const filter = new LogSearchFilter(params);
    const outcome = await dockerCommand.streamLogs(containerName, {
      since: params.since,
      until: params.until,
      timeoutMs: LOG_SEARCH_TIMEOUT_MS,
      onLine: (line, stream) => filter.push(line, stream),
    });

    if (outcome.timedOut) filter.markTimedOut();

    const result = filter.buildResult();

    // docker refusing to read the logs at all (a logging driver that does not support it, a
    // container removed in the meantime) must not be answered as an empty log : the caller would
    // conclude the container said nothing.
    if (outcome.exitCode !== 0 && result.totalLines === 0) {
      throw new ServiceUnavailableException({
        message:
          `Could not read the logs of '${containerName}': docker exited with the code ` +
          `${outcome.exitCode}. The container exists but its logs are not readable, check its ` +
          `logging driver.`,
        containerName,
      });
    }

    return result;
  }

  /**
   * A 404 naming the containers that do exist : the caller is a model, a bare "not found" costs it
   * a blind retry.
   */
  private async checkContainerExistsOrNotFound(
    containerName: string,
    dockerCommand: DockerCommand
  ): Promise<void> {
    // a name docker itself would refuse can only be a container that does not exist, and it must
    // not reach a command line
    const nameIsValid = DOCKER_CONTAINER_NAME_REGEX.test(containerName);
    if (nameIsValid && (await dockerCommand.containerExists(containerName))) return;

    throw new NotFoundException({
      message: `Container '${containerName}' does not exist on this lab.`,
      containerName,
      existingContainers: await dockerCommand.listContainerNames(),
    });
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
