import { Injectable, Logger } from '@nestjs/common';
import {
  ComposeRestartOptions,
  ComposeUpOptions,
  DockerInspect,
  DockerProgress,
  DockerPsFull,
  ErrorLogs,
} from './docker.class';
import { FileService } from '../core/services/file/file.service';
import { TaskService } from '../core/services/task/task.service';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';
import { DockerCommandService } from './docker-command/docker-command.service';
import { ContainerService } from './container/container.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { Containers } from './compose.class';
import { TraefikService } from '../core/services/traefik/traefik.service';
import { ComposeServiceName, ComposeYaml } from './compose-yaml';
export interface BeforeDockerCommandOptions {
  generateComposeFile?: boolean;
}

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);

  constructor(
    private dockerCommand: DockerCommandService,
    private fileService: FileService,
    private containerService: ContainerService,
    private taskService: TaskService,
    private gpuService: GPUService,
    private configService: CoreConfigService,
    private traefikService: TraefikService
  ) {}

  public async listContainers(): Promise<DockerInspect[]> {
    return await this.containerService.getAllContainerInspect();
  }

  public async getContainersDetail(containerName: string): Promise<DockerPsFull> {
    return await this.dockerCommand.getContainerFullInfo(containerName);
  }

  public getContainerSize(containerName: string): Promise<string> {
    return this.dockerCommand.getContainerSize(containerName);
  }

  public async pullContainers(beforeOptions: BeforeDockerCommandOptions = {}): Promise<void> {
    await this.beforeDockerCommand(beforeOptions);

    const taskName = 'Update services';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.composePull();
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
      if (!services || services.length === 0) {
        services = this.containerService.getComposeServiceNames();
      }
      const result = await this.dockerCommand.composeUp([], services);
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
      const result = await this.dockerCommand.composeStop(services);
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
      const result = await this.dockerCommand.composeDown(services);
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
      const result = await this.dockerCommand.composeStop();
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

  public async getLogs(containerName: string): Promise<string> {
    return await this.dockerCommand.getLogs(containerName);
  }

  public async getErrorLogs(containerName: string): Promise<string> {
    return await this.dockerCommand.getErrorLogs(containerName);
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

  public exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    return this.dockerCommand.exportLogsToFile(containerName, filePath);
  }

  public async systemPrune(): Promise<void> {
    // in local mode, don't prune because it breaks the local docker environment
    if (this.configService.isLocal()) return;

    const taskName = 'Clean system';
    this.taskService.newTask(taskName);

    try {
      const result = await this.dockerCommand.systemPrune();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async getComposeContainers(): Promise<Containers> {
    const containerNames: string[] = this.containerService.getComposeServiceNames();

    const containers = new Containers();
    for (const containerName of containerNames) {
      const inspect = await this.dockerCommand.dockerInspect(containerName);
      containers.addContainer(inspect);
    }

    return containers;
  }

  public async generateDockerCompose(): Promise<void> {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    let dockerComposeContent = this.fileService.readDockerComposeTemplate();

    const dashboardSubDomain = 'app';
    const dashboardSubDomainDev = 'app-dev';
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

    // handle app hosts
    dockerComposeContent = this.handleAppHosts(
      dockerComposeContent,
      ComposeServiceName.GLAB,
      dashboardSubDomain
    );
    dockerComposeContent = this.handleAppHosts(
      dockerComposeContent,
      ComposeServiceName.CODELAB,
      dashboardSubDomainDev
    );

    this.fileService.writeDockerCompose(dockerComposeContent);
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  /**
   *
   * @param dockerComposeContent Method to add labels to the glab service in the docker-compose file
   * to enable the additional app hosts for the dashboard. For Glab and CodeLab services.
   * @param baseHost
   * @returns
   */
  // TODO : deprecated @1.23.0. Remove once all labs are on v0.16.0
  private handleAppHosts(
    dockerComposeContent: string,
    serviceName: ComposeServiceName,
    baseHost: string
  ): string {
    // handle app hosts
    const appNbHost = this.configService.getAppHostsCount();
    const labels = [];

    const additionalPorts = [];
    const additionalHosts = [];
    for (let i = 0; i < appNbHost + 1; i++) {
      const subDomain = `${baseHost}${i}`;
      const host = this.buildHostString([subDomain]);
      const port = this.configService.getAppDefaultPort() + i;
      labels.push(...this.traefikService.getTraefikRouterLabels(host, port.toString(), `app-${subDomain}`));
      additionalPorts.push(port.toString());
      additionalHosts.push(subDomain);
    }

    const yml = new ComposeYaml(dockerComposeContent);

    // Add the env variable to the service to know the additional ports and hosts
    yml.addEnvironmentVariable(serviceName, 'APP_PORTS', additionalPorts.join(','));
    yml.addEnvironmentVariable(serviceName, 'APP_HOSTS', additionalHosts.join(','));

    if (!this.configService.isLocal()) {
      yml.addLabels(serviceName, labels);
    }

    return yml.toString();
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
