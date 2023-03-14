import { Injectable } from '@nestjs/common';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { DockerCommandService } from 'src/app/core/services/docker-command/docker-command.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { TraefikService } from 'src/app/core/services/traefik/traefik.service';

@Injectable()
export class ContainerService {

  private static readonly GLAB = 'glab';
  private static readonly CODELAB = 'codelab';
  private static readonly FRONT = 'front';
  private static readonly DB_GWS_CORE_PROD = 'gws_core_prod_db';
  private static readonly DB_GWS_BIOTA = 'gws_biota_db';
  private static readonly DB_GWS_CORE_DEV = 'gws_core_dev_db';
  private static readonly DB_GWS_CORE_DEV_TEST = 'test_gws_dev_db';

  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly ADMINER_NAME = 'adminer';
  public static readonly ADMINER_IMAGE: string = 'adminer:4.8.1';

  constructor(private dockerCommand: DockerCommandService,
    private taskService: TaskService,
    private traefikService: TraefikService,
    private configService: CoreConfigService) {
  }

  public getContainersNames(): string[] {
    return [
      this.getContainerName(ContainerService.GLAB),
      this.getContainerName(ContainerService.CODELAB),
      this.getContainerName(ContainerService.FRONT),
      this.getContainerName(ContainerService.DB_GWS_CORE_PROD),
      this.getContainerName(ContainerService.DB_GWS_BIOTA),
      this.getContainerName(ContainerService.DB_GWS_CORE_DEV),
      this.getContainerName(ContainerService.DB_GWS_CORE_DEV_TEST)];
  }

  public getContainerName(serviceName: string): string {
    if (this.configService.isLocal()) {
      return `dev_${serviceName}`;
    } else {
      return serviceName;
    }
  }

  /////////////////////////////// CONTAINERS ///////////////////////////////
  public async containerIsRunning(serviceName: string): Promise<boolean> {
    const container = await this.dockerCommand.dockerContainerInfo(
      this.getContainerName(serviceName));

    if (container == null) return false;

    return container.state === 'running';
  }

  public async removeContainer(serviceName: string): Promise<boolean> {
    const containerName = this.getContainerName(serviceName);
    // return false if the container is not running
    if (!(await this.containerIsRunning(containerName))) return false;


    const taskName = `STOP ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      await this.dockerCommand.dockerRmContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  /////////////////////////////// BIOTA ///////////////////////////////


  public deleteBiotaService(): Promise<boolean> {
    return this.removeContainer(ContainerService.DB_GWS_BIOTA);
  }


  public async startBiotaService(): Promise<void> {
    const taskName = 'START BIOTA';
    this.taskService.newTask(taskName);

    try {
      // start biota service from docker-compose
      const result = await this.dockerCommand.composeUp([], 
        [ContainerService.DB_GWS_BIOTA])
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  /////////////////////////////// ADMINER ///////////////////////////////
  public async adminerIsRunning(): Promise<boolean> {
    return this.containerIsRunning(ContainerService.ADMINER_NAME);
  }

  public async startAdminerService(): Promise<boolean> {
    const taskName = 'START ADMINER';
    this.taskService.newTask(taskName);

    try {
      const containerName = this.getContainerName(ContainerService.ADMINER_NAME);
      const labels = this.traefikService.getTraefikLabels(containerName, '8080');

      const networks = [ContainerService.NETWORK_DEV, ContainerService.NETWORK_PROD];
      const result = await this.dockerCommand.dockerRun(ContainerService.ADMINER_IMAGE, containerName, {
        networks: networks, labels: labels
      });
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return result;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteAdminerService(): Promise<boolean> {
    return this.removeContainer(ContainerService.ADMINER_NAME);
  }
}
