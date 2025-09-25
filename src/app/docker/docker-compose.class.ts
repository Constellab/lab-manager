import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { Command, ExecCommandMode } from '../core/utils/command';
import { ComposeYaml } from './compose-yaml';
import { DockerCommand } from './docker-command.class';
import { ContainersInspect } from './docker-inspect.class';

export class DockerCompose {
  private readonly logger = new Logger(DockerCompose.name);

  private composeYaml: ComposeYaml;

  constructor(
    private composeFilePath: string,
    private envFilePath: string,
    private brickName: string,
    private uniqueName: string
  ) {
    this.loadComposeYaml(composeFilePath);
  }

  private loadComposeYaml(composeFilePath: string): void {
    if (!existsSync(composeFilePath)) {
      throw new Error(`The docker-compose file ${composeFilePath} does not exist`);
    }

    const strYaml = readFileSync(this.composeFilePath, { encoding: 'utf-8' });
    this.composeYaml = new ComposeYaml(strYaml);
  }

  public getComposeYaml(): ComposeYaml {
    return this.composeYaml;
  }

  public getContainerNames(): string[] {
    return this.composeYaml.getContainerNames();
  }

  public composeInspect(): Promise<ContainersInspect> {
    const dockerCommand = new DockerCommand();
    return dockerCommand.dockerInspectMultiple(this.getContainerNames());
  }

  /**
   * Call a docker compose up command
   * @param options
   * @param containers if provided, only up the containers
   */
  public composeUp(options: string[] = [], containers: string[] = []): Promise<string> {
    return this.execDockerComposeCommand(`up -d ${options.join(' ')} ${containers.join(' ')}`);
  }

  public composePull(): Promise<string> {
    return this.execDockerComposeCommand(`pull`);
  }

  public composeRestart(): Promise<string> {
    return this.execDockerComposeCommand('restart');
  }

  public composeStop(containers: string[] = []): Promise<string> {
    return this.execDockerComposeCommand(`stop ${containers.join(' ')}`);
  }

  public composeDown(containers: string[] = []): Promise<string> {
    return this.execDockerComposeCommand(`down ${containers.join(' ')}`);
  }

  private execDockerComposeCommand(options: string): Promise<string> {
    const command: string =
      `docker compose -f ${this.composeFilePath} ` + `--env-file ${this.envFilePath} ${options}`;
    return new Command().execCommand(command);
  }

  /**
   * Start one service from the docker-compose file
   * @param serviceName
   * @returns true if the service was started, false if the service was already running
   * @throws error if the service can't be started
   */
  public async startService(serviceName: string): Promise<boolean> {
    this.checkServiceExists(serviceName);
    if (await this.serviceIsReady(serviceName)) return false;

    this.logger.log(`Starting compose service ${serviceName}`);
    await this.composeUp([], [serviceName]);

    if (!(await this.waitForServiceToBeReady(serviceName))) {
      throw new Error(`The service ${serviceName} is not running`);
    }

    this.logger.log(`service ${serviceName} started`);
    return true;
  }

  /**
   * Stop one service from the docker-compose file
   * @param serviceName
   * @returns true if the service was stopped, false if the service was already stopped
   * @throws error if the service can't be stopped
   */
  public async downService(serviceName: string): Promise<boolean> {
    this.checkServiceExists(serviceName);
    if (!(await this.serviceIsRunning(serviceName))) return false;

    this.logger.log(`Stopping compose service ${serviceName}`);
    await this.composeDown([serviceName]);

    if (!(await this.waitForServiceToBeStopped(serviceName))) {
      throw new Error(`The service ${serviceName} is not stopped`);
    }

    this.logger.log(`service ${serviceName} stopped`);
    return true;
  }

  /**
   * Execute a command in a service from the docker-compose file.
   * If the service is not running, it will be started and stopped after the command.
   * @param serviceName
   * @param command
   * @returns
   */
  protected async execCommandInService(serviceName: string, command: string): Promise<string> {
    this.checkServiceExists(serviceName);
    const wasStarted = await this.startService(serviceName);
    const containerName = this.composeYaml.getContainerNameFromService(serviceName);

    let result: string;
    try {
      const dockerCommand = new DockerCommand();
      result = await dockerCommand.dockerExec(containerName, command);
    } finally {
      if (wasStarted) {
        await this.downService(serviceName);
      }
    }
    return result;
  }

  private checkServiceExists(serviceName: string): void {
    if (!this.composeYaml.serviceExists(serviceName)) {
      throw new Error(
        `The service ${serviceName} does not exist in the compose file ${this.brickName} ${this.uniqueName}`
      );
    }
  }

  public async waitForServiceToBeReady(serviceName: string): Promise<boolean> {
    return this.waitForServiceStatus(serviceName, 'ready');
  }

  public async waitForServiceToBeStopped(serviceName: string): Promise<boolean> {
    return this.waitForServiceStatus(serviceName, 'stopped');
  }

  public async waitForServiceStatus(serviceName: string, mode: 'ready' | 'stopped'): Promise<boolean> {
    // test if the service is start or stop each 3 seconds during 60 seconds
    this.checkServiceExists(serviceName);
    let i = 0;
    while (i < 20) {
      let isOk = false;
      if (mode === 'ready') {
        isOk = await this.serviceIsReady(serviceName);
      } else {
        isOk = !(await this.serviceIsReady(serviceName));
      }
      if (isOk) return true;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      i++;
    }

    return false;
  }

  public async serviceIsRunning(serviceName: string): Promise<boolean> {
    this.checkServiceExists(serviceName);
    const containerName = this.composeYaml.getContainerNameFromService(serviceName);
    const dockerCommand = new DockerCommand();
    return dockerCommand.containerIsRunning(containerName);
  }

  /**
   * Check if the service is running.
   * Then based on image type check if the service is ready.
   */
  public async serviceIsReady(serviceName: string): Promise<boolean> {
    this.checkServiceExists(serviceName);
    const containerName = this.composeYaml.getContainerNameFromService(serviceName);
    const dockerCommand = new DockerCommand();
    const container = await dockerCommand.dockerInspect(containerName);
    if (!container.exists()) return false;

    // check if the container is ready
    if (container.isMariaDbOrMySql())
      // if the container is a mysql container, check if the mysql is ready
      try {
        // check if the mysql socket is ready
        await dockerCommand.dockerExec(
          containerName,
          `sh -c "mysqladmin ping --host='localhost' --user='root' --password=\\$MYSQL_ROOT_PASSWORD"`,
          ExecCommandMode.NO_LOG
        );
      } catch (e) {
        return false;
      }

    return true;
  }
}
