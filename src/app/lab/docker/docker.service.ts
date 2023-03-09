import {Injectable, Logger} from '@nestjs/common';
import {DockerCommandService} from '../../core/services/docker-command/docker-command.service';
import {ComposeRestartOptions, ComposeUpOptions, DockerPs} from '../docker.class';
import {FileService} from '../../core/services/file/file.service';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {ContainerService} from '../container/container.service';
import {TaskService} from '../../core/services/task/task.service';
import {ContainerStatusInfo} from '../lab.class';
import {EnvVariableService} from '../env-variable/env-variable.service';
import {TraefikService} from '../../core/services/traefik/traefik.service';

export interface BeforeDockerCommandOptions {
  setEnvVariables?: boolean;
  dockerLogin?: boolean;
  generateComposeFile?: boolean;
}


@Injectable()
export class DockerService {

  private readonly logger = new Logger(DockerService.name);

  constructor(private dockerCommand: DockerCommandService,
    private fileService: FileService, private containerService: ContainerService,
    private taskService: TaskService, private configService: CoreConfigService,
    private envVariableService: EnvVariableService, private traefikService: TraefikService) {
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
      throw e;
    }
  }

  public async listContainers(): Promise<DockerPs[]> {
    return this.dockerCommand.dockerPs();
  }

  public async pullContainers(beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

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
      const result = await this.dockerCommand.composeUp(this.fileService.dockerComposePath);
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
    const containers: DockerPs[] = await this.listContainers();

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

  public generateDockerCompose(): void {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    this.fileService.copyDockerCompose();
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private async beforeDockerCommand(options: BeforeDockerCommandOptions): Promise<void> {
    if (!options) return;
    if (options.generateComposeFile) {
      this.generateDockerCompose();
    }

    if (options.setEnvVariables) {
      await this.envVariableService.setEnvVariables();
    }

    if (options.dockerLogin) {
      await this.login();
    }
  }

  /////////////////////////////// ADMINER ///////////////////////////////

  public async adminerIsRunning(): Promise<boolean> {
    const container = await this.dockerCommand.dockerContainerInfo(ContainerService.ADMINER_NAME);

    if (container == null) {
      return false;
    }

    return container.state === 'running';
  }

  public async startAdminerService(): Promise<boolean> {
    const taskName = 'START ADMINER';
    this.taskService.newTask(taskName);

    try {
      const labels = this.traefikService.getTraefikLabels(ContainerService.ADMINER_NAME, '8080');

      const networks = [ContainerService.NETWORK_DEV, ContainerService.NETWORK_PROD];
      const result = await this.dockerCommand.dockerRun(ContainerService.ADMINER_IMAGE, ContainerService.ADMINER_NAME, {
        networks: networks, labels: labels
      });
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return result;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopAdminerService(): Promise<boolean> {
    const taskName = 'STOP ADMINER';
    this.taskService.newTask(taskName);

    try {
      await this.dockerCommand.dockerRmContainer(ContainerService.ADMINER_NAME);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }
}
