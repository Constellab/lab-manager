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

  public async listContainers(): Promise<DockerPs[]> {
    const containers = await this.dockerCommand.dockerPs();

    // add the default containers if they are not in the list
    const defaultContainers = this.containerService.getServiceNames();
    for (const defaultContainer of defaultContainers) {
      if (!containers.find(c => c.names === defaultContainer)) {
        containers.push({
          names: defaultContainer,
          state: 'none'
        });
      }
    }

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

  public async upContainerCommand(services: string[] = []): Promise<void> {
    const taskName = 'UP_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      if (!services || services.length === 0) {
        services = this.containerService.getServiceNames();
      }
      const result = await this.dockerCommand.composeUp([], services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopContainers(services: string[] = []): Promise<void> {
    const taskName = 'STOP_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composeStop(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteContainers(services: string[] = []): Promise<void> {
    const taskName = 'DELETE_CONTAINERS';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composeDown(services);
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

  public exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    return this.dockerCommand.exportLogsToFile(containerName, filePath);
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

    const containerNames: string[] = this.containerService.getServiceNames();

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
    
    // list of variable in the docker-compose file that need to be replaced
    const toReplaces = [
      {
        subDomain: 'glab',
        replacementText: '#GLAB_HOST#'
      },
      {
        subDomain: 'dashboard',
        replacementText: '#GLAB_DASHBOARD_HOST#'
      },
      // TODO TO BE REMOVED
      {
        subDomain: 'lab',
        replacementText: '#FRONT_LAB_HOST#'
      },
      {
        subDomain: 'dev-lab',
        replacementText: '#FRONT_DEV_LAB_HOST#'
      },
    ]
    for(const toReplace of toReplaces) {
      // build the standard host string like : host(`glab.${VIRTUAL_HOST}`)
      let newContent = 'host(`' + toReplace.subDomain + '.${VIRTUAL_HOST}`)';
      
      const additionalDomains = this.configService.getAddtionalDomains();
      // if there are additional hosts, add them to the host string
      if(additionalDomains && additionalDomains.length > 0) {
        for(const additionalHost of additionalDomains) {
          // add an host for each additional host, keep the same sub domain
          newContent += ` || host(\`${toReplace.subDomain}.${additionalHost}\`)`
        }
      }

      // replace all the content in the docker-compose file
      dockerComposeContent = dockerComposeContent.replace(new RegExp(toReplace.replacementText, 'g'), newContent);
    }

    this.fileService.writeDockerCompose(dockerComposeContent)
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private async beforeDockerCommand(options: BeforeDockerCommandOptions): Promise<void> {
    if (!options) return;
    if (options.generateComposeFile) {
      this.generateDockerCompose();
    }
  }
}
