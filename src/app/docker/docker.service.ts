import { Injectable, Logger } from '@nestjs/common';
import { ComposeRestartOptions, ComposeUpOptions, DockerPs, DockerPsFull } from './docker.class';
import { FileService } from '../core/services/file/file.service';
import { TaskService } from '../core/services/task/task.service';
import { ContainerStatusInfo } from '../lab/lab.class';
import { PrivateFile } from 'src/app/core/models/private-file.class';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';
import { DockerCommandService } from './docker-command/docker-command.service';
import { ContainerService } from './container/container.service';
import { CoreConfigService } from '../core/services/config/core-config.service';

export interface BeforeDockerCommandOptions {
  dockerLogin?: boolean;
  generateComposeFile?: boolean;
}


@Injectable()
export class DockerService {

  private readonly logger = new Logger(DockerService.name);

  constructor(private dockerCommand: DockerCommandService,
    private fileService: FileService,
    private containerService: ContainerService,
    private taskService: TaskService,
    private gpuService: GPUService,
    private configService: CoreConfigService) {
  }

  public async login(): Promise<void> {
    const taskName = 'DOCKER_LOGIN';
    this.taskService.newTask(taskName);


    try {

      const privateFile: PrivateFile = this.fileService.readPrivateFile();
      await this.dockerCommand.login(
        privateFile.docker_registry.username,
        privateFile.docker_registry.password,
        privateFile.docker_registry.url
      );
      this.taskService.markTaskAsSuccess(taskName);
    } catch (e: any) {
      // eslint-disable-next-line max-len
      this.taskService.markTaskAsError(taskName, `Can't log in to the docker registry. Error: ${e.message}`);
      throw e;
    }
  }

  public async listContainers(): Promise<DockerPs[]> {
    const containers = await this.dockerCommand.dockerPs();
    return containers.sort((a, b) => a.names.localeCompare(b.names));
  }

  public async getContainersDetail(containerName: string): Promise<DockerPsFull> {
    return await this.dockerCommand.getContainerInfo(containerName);
  }

  public async pullContainers(beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    const taskName = 'PULL_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composePull();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async upContainers(options: ComposeUpOptions, beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    if (options.updateContainers) {
      await this.pullContainers();
    }

    await this.upContainerCommand();

    if (options.pruneSystem) {
      await this.systemPrune();
    }
  }

  private async upContainerCommand(): Promise<void> {
    const taskName = 'UP_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const containers = this.containerService.getComposeServiceNames();
      const result = await this.dockerCommand.composeUp([], containers);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteContainers(): Promise<void> {
    const taskName = 'DELETE_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composeDown();
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
      const result = await this.dockerCommand.composeStop();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async restartContainers(options: ComposeRestartOptions, beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    if (options.updateContainers) {
      await this.pullContainers();
    }

    if (options.destroyContainers) {
      await this.deleteContainers();

      await this.upContainerCommand();
    } else {
      // do a stop and a up because if a new image is available with same tag, restart doesn't update it. Stop and up does.
      await this.composeStop();
      await this.upContainerCommand();
    }

    if (options.pruneSystem) {
      await this.systemPrune();
    }
  }


  public async getLogs(containerName: string): Promise<string> {
    return await this.dockerCommand.getLogs(containerName);
  }

  public async systemPrune(): Promise<void> {
    // in local mode, don't prune because it breaks the local docker environment
    if (this.configService.isLocal()) return;
    
    const taskName = 'SYSTEM PRUNE';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.systemPrune();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async getContainersStatus(): Promise<ContainerStatusInfo> {
    const containers: DockerPs[] = await this.dockerCommand.dockerPs();

    const containerNames: string[] = this.containerService.getContainersNames();

    const containersDown: string[] = [];
    const containersStop: string[] = [];
    const containersUp: string[] = [];

    for (const containerName of containerNames) {
      const container: DockerPs = containers.find(c => c.names === containerName);

      if (container == null) {
        containersDown.push(containerName);
        continue;
      }

      if (container.state === 'running') {
        containersUp.push(containerName);
      } else {
        containersStop.push(containerName);
      }
    }

    if (containersUp.length === containerNames.length) {
      return {
        status: 'UP',
        info: 'All containers are running'
      };
    }

    if (containersDown.length === containerNames.length) {
      return {
        status: 'DOWN',
        info: 'The containers does not exist'
      };
    }

    if (containersStop.length === containerNames.length) {
      return {
        status: 'STOP',
        info: 'All containers are stopped'
      };
    }

    return {
      status: 'PARTIALLY_UP',
      info: 'Containers are partially up'
    };
  }

  public async generateDockerCompose(): Promise<void> {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    let dockerComposeContent = this.fileService.readDockerComposeTemplate();

    // replace the GPU config in the docker-compose file
    const gpuConfig = await this.gpuService.getDockerComposeGpuConfig();
    dockerComposeContent = dockerComposeContent.replace(/#GPU_CONFIG#/g, gpuConfig);

    this.fileService.writeDockerCompose(dockerComposeContent)
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private async beforeDockerCommand(options: BeforeDockerCommandOptions): Promise<void> {
    if (!options) return;
    if (options.generateComposeFile) {
      this.generateDockerCompose();
    }

    if (options.dockerLogin) {
      await this.login();
    }
  }
}
