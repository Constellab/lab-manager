import { Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { TraefikService } from 'src/app/core/services/traefik/traefik.service';
import { DockerCommandService } from '../docker-command/docker-command.service';
import { ConfigFileService } from 'src/app/core/services/config-file/config-file.service';
import { ExecCommandMode } from 'src/app/core/services/command/command.service';

@Injectable()
export class ContainerService {

  private static readonly GLAB = 'glab';
  private static readonly CODELAB = 'codelab';
  private static readonly FRONT = 'front';
  public static readonly DB_GWS_CORE_PROD = 'gws_core_prod_db';
  private static readonly DB_GWS_BIOTA = 'gws_biota_db';
  private static readonly DB_GWS_CORE_DEV = 'gws_core_dev_db';
  private static readonly DB_GWS_CORE_DEV_TEST = 'test_gws_dev_db';

  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly ADMINER_NAME = 'adminer';
  public static readonly ADMINER_IMAGE: string = 'adminer:4.8.1';

  private readonly logger = new Logger(ContainerService.name);

  constructor(private dockerCommand: DockerCommandService,
    private taskService: TaskService,
    private traefikService: TraefikService,
    private configFileService: ConfigFileService) {
  }

  /////////////////////////////// COMPOSE CONTAINER ///////////////////////////////

  public getServiceNames(): string[] {
    const containers = [
      ContainerService.GLAB,
      ContainerService.CODELAB,
      ContainerService.FRONT,
      ContainerService.DB_GWS_CORE_PROD,
      ContainerService.DB_GWS_CORE_DEV,
      ContainerService.DB_GWS_CORE_DEV_TEST];

    // add biota container only if biota is active
    if (this.configFileService.biotaIsActive()) {
      containers.push(ContainerService.DB_GWS_BIOTA);
    }
    return containers;
  }
  /**
    * Start one container from the docker-compose file
    * @param serviceName
    * @returns true if the container was started, false if the container was already running
    * @throws error if the container can't be started
    */
  public async startComposeContainer(serviceName: string): Promise<boolean> {
    if (await this.containerIsRunning(serviceName)) return false;

    this.logger.log(`Starting compose service ${serviceName}`);
    await this.dockerCommand.composeUp([], [serviceName]);

    if (!await this.waitForContainerToBeReady(serviceName)) {
      throw new Error(`The container ${serviceName} is not running`);
    }

    this.logger.log(`Container ${serviceName} started`);
    return true;
  }

  /**
   * Stop one container from the docker-compose file
   * @param serviceName
   * @returns true if the container was stopped, false if the container was already stopped
   * @throws error if the container can't be stopped
   */
  public async downComposeContainer(serviceName: string): Promise<boolean> {
    if (!await this.containerIsRunning(serviceName)) return false;

    this.logger.log(`Stopping compose service ${serviceName}`);
    await this.dockerCommand.composeDown([serviceName]);

    if (!await this.waitForContainerToBeStopped(serviceName)) {
      throw new Error(`The container ${serviceName} is not stopped`);
    }

    this.logger.log(`Container ${serviceName} stopped`);
    return true;
  }

  /**
   * Execute a command in a container from the docker-compose file.
   * If the container is not running, it will be started and stopped after the command.
   * @param serviceName 
   * @param command 
   * @returns 
   */
  private async execCommandInComposeContainer(serviceName: string, command: string): Promise<string> {
    const wasStarted = await this.startComposeContainer(serviceName);

    let result: string;
    try {
      result = await this.dockerCommand.dockerExec(serviceName, command);
    } finally {
      if (wasStarted) {
        await this.downComposeContainer(serviceName);
      }
    }
    return result;
  }

  public checkIsComposeService(serviceName: string): boolean {
    return this.getServiceNames().includes(serviceName);
  }

  /////////////////////////////// CONTAINERS ///////////////////////////////
  public async containerExists(containerName: string): Promise<boolean> {
    return (await this.dockerCommand.dockerContainerInfo(containerName)) != null;
  }

  public async containerIsRunning(containerName: string): Promise<boolean> {
    const container = await this.dockerCommand.dockerContainerInfo(containerName);

    if (container == null) return false;

    return container.state === 'running';
  }


  /**
   * Check if the containers is running. Then based on image type check if the container is ready.
   */
  public async containerIsReady(containerName: string): Promise<boolean> {
    const isRunning = await this.containerIsRunning(containerName);
    if (!isRunning) return false;

    // check if the container is ready

    // if the container is a mysql container, check if the mysql is ready
    if ([ContainerService.DB_GWS_CORE_PROD, ContainerService.DB_GWS_CORE_DEV,
    ContainerService.DB_GWS_CORE_DEV_TEST, ContainerService.DB_GWS_BIOTA].includes(containerName)) {
      try {
        // check if the mysql socket is ready
        await this.dockerCommand.dockerExec(containerName,
          `sh -c "mysqladmin ping --host='localhost' --user='root' --password=\\$MYSQL_ROOT_PASSWORD"`,
          ExecCommandMode.NO_LOG);
      }
      catch (e) {
        return false;
      }
    }

    return true;
  }

  public async deleteContainer(containerName: string): Promise<boolean> {
    // return false if the container is not running
    const container = await this.dockerCommand.dockerContainerInfo(containerName);
    if(container == null) return false;

    const taskName = `DELETE ${containerName}`;
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

  public async stopContainer(containerName: string): Promise<boolean> {
    // return false if the container is not running
    if (!(await this.containerExists(containerName))) return false;

    const taskName = `STOP ${containerName}`;
    this.taskService.newTask(taskName);

    try {
      await this.dockerCommand.stopContainer(containerName);
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async waitForContainerToBeReady(containerName: string): Promise<boolean> {
    return this.waitForContainerStatus(containerName, 'ready');
  }

  public async waitForContainerToBeStopped(containerName: string): Promise<boolean> {
    return this.waitForContainerStatus(containerName, 'stopped');
  }

  public async waitForContainerStatus(containerName: string, mode: 'ready' | 'stopped'): Promise<boolean> {

    // test if the container is start or stop each 3 seconds during 60 seconds
    let i = 0;
    while (i < 20) {
      let isOk = false;
      if (mode === 'ready') {
        isOk = await this.containerIsReady(containerName);
      } else {
        isOk = !(await this.containerIsRunning(containerName));
      }
      if (isOk) return true;
      await new Promise(resolve => setTimeout(resolve, 3000));
      i++;
    }

    return false;
  }


  /////////////////////////////// BIOTA ///////////////////////////////


  public deleteBiotaService(): Promise<boolean> {
    return this.deleteContainer(ContainerService.DB_GWS_BIOTA);
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
      const containerName = ContainerService.ADMINER_NAME;
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
    return this.deleteContainer(ContainerService.ADMINER_NAME);
  }


  /////////////////////////////// PROD DB ///////////////////////////////

  public async dumpProdDb(dumpLocation: string): Promise<string> {
    return await this.execCommandInComposeContainer(ContainerService.DB_GWS_CORE_PROD,
      `sh -c "mysqldump --user='root' --password=\\$MYSQL_ROOT_PASSWORD \\$MYSQL_DATABASE > ${dumpLocation}"`);
  }

  public async restoreProdDb(dumpLocation: string): Promise<string> {
    return await this.execCommandInComposeContainer(ContainerService.DB_GWS_CORE_PROD,
      `sh -c "mysql --user='root' --password=\\$MYSQL_ROOT_PASSWORD \\$MYSQL_DATABASE < ${dumpLocation}"`);
  }

  public async prodDbIsRunning(): Promise<boolean> {
    return this.containerIsRunning(ContainerService.DB_GWS_CORE_PROD);
  }
}
