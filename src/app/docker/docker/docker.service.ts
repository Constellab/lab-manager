import {Injectable} from '@nestjs/common';
import {DockerCommandService} from '../../core/services/docker-command/docker-command.service';
import {ComposeUpOptions, DockerPs} from '../docker.class';
import {FileService} from '../../core/services/file/file.service';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {ContainerService} from '../container/container.service';
import {TaskService} from '../../core/services/task/task.service';

export enum ContainersStatus {
  STOP = 'STOP',
  DOWN = 'DOWN',
  UP = 'UP',
  PARTIALLY_UP = 'PARTIALLY_UP'
}

export interface ContainerStatusInfo {
  status: ContainersStatus;
  info?: string;
}

@Injectable()
export class DockerService {


  constructor(private dockerCommand: DockerCommandService,
    private fileService: FileService, private containerService: ContainerService,
    private taskService: TaskService, private configService: CoreConfigService) {
  }

  public async login(): Promise<void> {
    const taskName = 'DOCKER_LOGIN';
    this.taskService.newTask(taskName);

    try {
      await this.dockerCommand.login(
        this.configService.getDockerRegistryUsername(),
        this.configService.getDockerRegistryPassword(),
        this.configService.getDockerRegistryUrl()
      );
      this.taskService.markTaskAsSuccess(taskName);
    } catch (e: any) {
      // eslint-disable-next-line max-len
      this.taskService.markTaskAsError(taskName, `Can't log in to the docker registry '${this.configService.getDockerRegistryUrl()}' with user ${this.configService.getDockerRegistryUsername()}`);
    }
  }

  public async listContainers(): Promise<DockerPs[]> {
    const result = await this.dockerCommand.dockerPs();

    return JSON.parse('[' + result.slice(0, -2) + ']');
  }

  public async pullContainers(): Promise<void> {
    const taskName = 'PULL_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composePull(this.fileService.dockerComposePath);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async upContainers(options: ComposeUpOptions): Promise<void> {
    const taskName = 'UP_CONTAINERS';
    this.taskService.newTask(taskName);

    if (options.updateBricks) {
      CoreConfigService.setEnvVariable('UPDATE_GIT_BRICKS', '1');
    } else {
      CoreConfigService.setEnvVariable('UPDATE_GIT_BRICKS', '0');
    }

    try {
      const result = await this.dockerCommand.composeUp(this.fileService.dockerComposePath);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async downContainers(): Promise<void> {
    const taskName = 'DOWN_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composeDown(this.fileService.dockerComposePath);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async composeStop(): Promise<void> {
    const taskName = 'STOP_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composeStop(this.fileService.dockerComposePath);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async restartContainers(options: ComposeUpOptions): Promise<any> {
    await this.composeStop();

    return await this.upContainers(options);
  }

  public async getLogs(containerName: string): Promise<string> {
    return await this.dockerCommand.getLogs(containerName);
  }

  public async getContainersStatus(): Promise<ContainerStatusInfo> {
    const containers: DockerPs[] = await this.listContainers();

    const containerNames: string[] = this.containerService.getContainersNames();

    const containersDown: string[] = [];
    const containersStop: string[] = [];
    const containersUp: string[] = [];

    for (const containerName of containerNames) {
      const container: DockerPs = containers.find(c => c.Names === containerName);

      if (container == null) {
        containersDown.push(containerName);
        continue;
      }

      if (container.State === 'running') {
        containersUp.push(containerName);
      } else {
        containersStop.push(containerName);
      }
    }

    if (containersUp.length === containerNames.length) {
      return {
        status: ContainersStatus.UP,
        info: 'All containers are running'
      };
    }

    if (containersDown.length === containerNames.length) {
      return {
        status: ContainersStatus.DOWN,
        info: 'The containers does not exist'
      };
    }

    if (containersStop.length === containerNames.length) {
      return {
        status: ContainersStatus.STOP,
        info: 'All containers are stopped'
      };
    }

    return {
      status: ContainersStatus.PARTIALLY_UP,
      info: 'Containers are partially up'
    };

  }
}
