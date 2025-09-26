import { Injectable, Logger } from '@nestjs/common';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from '../../core/services/task/task.service';
import { DockerCommand } from '../docker-command.class';
import { ContainersInspect } from '../docker-inspect.class';
import {
  ComposeRestartOptions,
  ComposeUpOptions,
  DockerProgress,
  DockerPsFull,
  ErrorLogs,
} from '../docker.class';
import { DockerComposeService } from './docker-compose.service';

export interface BeforeDockerCommandOptions {
  generateComposeFile?: boolean;
}

/**
 * Service to manage the main docker-compose file and its services
 */
@Injectable()
export class MainComposeService {
  private readonly logger = new Logger(MainComposeService.name);

  constructor(
    private fileService: FileService,
    private taskService: TaskService,
    private gpuService: GPUService,
    private configService: CoreConfigService,
    private dockerComposeService: DockerComposeService
  ) {}

  public async inspectContainers(): Promise<ContainersInspect> {
    const mainCompose = this.dockerComposeService.createMainComposeObject();
    return await mainCompose.composeInspect();
  }

  public async getContainersDetail(containerName: string): Promise<DockerPsFull> {
    const dockerCommand = new DockerCommand();
    return await dockerCommand.getContainerFullInfo(containerName);
  }

  public getContainerSize(containerName: string): Promise<string> {
    const dockerCommand = new DockerCommand();
    return dockerCommand.getContainerSize(containerName);
  }

  public async pullContainers(beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    const taskName = 'Update services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      const result = await mainCompose.composePull();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async upContainers(
    options: ComposeUpOptions,
    beforeOptions: BeforeDockerCommandOptions = {}
  ): Promise<void> {
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
    const taskName = 'Start services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      const result = await mainCompose.composeUp([], services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopContainers(services: string[] = []): Promise<void> {
    const taskName = 'Stop services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      const result = await mainCompose.composeStop(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteContainers(services: string[] = []): Promise<void> {
    const taskName = 'Delete services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      const result = await mainCompose.composeDown(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async composeStop(): Promise<void> {
    const taskName = 'Stop services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      const result = await mainCompose.composeStop();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async restartContainers(
    options: ComposeRestartOptions,
    beforeOptions: BeforeDockerCommandOptions = {}
  ): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    if (options.updateContainers) {
      await this.pullContainers();
    }

    if (options.destroyContainers) {
      await this.deleteContainers();

      await this.upContainerCommand();
    } else {
      // do a stop and a up because if a new image is available
      // with same tag, restart doesn't update it. Stop and up does.
      await this.composeStop();
      await this.upContainerCommand();
    }

    if (options.pruneSystem) {
      await this.systemPrune();
    }
  }

  /**
   * Get start error logs from the glab container
   */
  public async getGlabStartErrorLogs(mode: 'prod' | 'dev'): Promise<ErrorLogs> {
    const logs = this.fileService.readLogStartFileIfExists(mode);
    if (!logs) return null;

    return {
      logs: logs.errors.join('\n'),
      mainErrors: logs.main_errors,
    };
  }

  public async getGlabStartProgressLogs(mode: 'prod' | 'dev'): Promise<DockerProgress> {
    const logs = this.fileService.readLogStartFileIfExists(mode);
    if (!logs) return null;

    return logs.progress;
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

  public async generateDockerCompose(): Promise<void> {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    let dockerComposeContent = this.fileService.readDockerComposeTemplate();

    if (!this.configService.isLocal()) {
      // replace the GPU config in the docker-compose file
      const gpuConfig = await this.gpuService.getDockerComposeGpuConfig();
      dockerComposeContent = dockerComposeContent.replace(/#GPU_CONFIG#/g, gpuConfig);

      const frontProdDomains = ['lab', 'front'];
      const frontDevDomains = ['dev-lab'];

      // list of variable in the docker-compose file that need to be replaced
      const toReplaces = [
        {
          subDomains: ['glab'],
          replacementText: '#GLAB_HOST#',
        },
        {
          subDomains: [...frontProdDomains, ...frontDevDomains],
          replacementText: '#FRONT_LAB_HOST#',
        },
      ];

      for (const toReplace of toReplaces) {
        const newContent = this.buildHostString(toReplace.subDomains);

        // replace all the content in the docker-compose file
        dockerComposeContent = dockerComposeContent.replace(
          new RegExp(toReplace.replacementText, 'g'),
          newContent
        );
      }

      // provide the PROD_FRONT_URLS and DEV_FRONT_URLS to the docker-compose file
      const prodFrontUrls = this.buildFrontUrls(frontProdDomains);
      dockerComposeContent = dockerComposeContent.replace(
        new RegExp('#FRONT_PROD_URLS#', 'g'),
        prodFrontUrls
      );

      const devFrontUrls = this.buildFrontUrls(frontDevDomains);
      dockerComposeContent = dockerComposeContent.replace(new RegExp('#FRONT_DEV_URLS#', 'g'), devFrontUrls);
    }

    this.fileService.writeDockerCompose(dockerComposeContent);
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private buildHostString(subDomains: string[]): string {
    // build the standard host string like : host(`glab.${VIRTUAL_HOST}`)
    const hosts: string[] = [];

    for (const subDomain of subDomains) {
      hosts.push('host(`' + subDomain + '.${VIRTUAL_HOST}`)');

      const additionalDomains = this.configService.getAddtionalDomains();
      // if there are additional hosts, add them to the host string
      if (additionalDomains && additionalDomains.length > 0) {
        for (const additionalHost of additionalDomains) {
          // add an host for each additional host, keep the same sub domain
          hosts.push(`host(\`${subDomain}.${additionalHost}\`)`);
        }
      }
    }

    return hosts.join(' || ');
  }

  private buildFrontUrls(subDomains: string[]): string {
    return subDomains.map((subDomain) => 'https://' + subDomain + '.${VIRTUAL_HOST}').join(',');
  }

  private async beforeDockerCommand(options: BeforeDockerCommandOptions): Promise<void> {
    if (!options) return;
    if (options.generateComposeFile) {
      await this.generateDockerCompose();
    }
  }
}
