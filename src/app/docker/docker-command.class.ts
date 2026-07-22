import { BadRequestException, Logger } from '@nestjs/common';
import { Command, ExecCommandMode } from '../core/utils/command';
import { DockerComposeInspect } from './compose/docker-compose-inspect.class';
import { DockerInspect, DockerPsFull, DockerRunOptions } from './docker.class';

export interface DockerFormatKey {
  key: string; // key in the json
  dockerKey: string; // docker key path
  hasQuotes?: boolean; // if the value already has quotes
}

export interface DockerExecOptions {
  user?: string;
  interactive?: boolean; // -i flag for stdin support
}

export class DockerFormatKeys {
  public static readonly NAMES: DockerFormatKey = { key: 'names', dockerKey: 'Names' };
  public static readonly IMAGE: DockerFormatKey = { key: 'image', dockerKey: 'Image' };
  public static readonly ID: DockerFormatKey = { key: 'id', dockerKey: 'ID' };
  public static readonly COMMAND: DockerFormatKey = { key: 'command', dockerKey: 'Command', hasQuotes: true };
  public static readonly CREATED_AT: DockerFormatKey = { key: 'createdAt', dockerKey: 'CreatedAt' };
  public static readonly MOUNTS: DockerFormatKey = { key: 'mounts', dockerKey: 'Mounts' };
  public static readonly NETWORKS: DockerFormatKey = { key: 'networks', dockerKey: 'Networks' };
  public static readonly PORTS: DockerFormatKey = { key: 'ports', dockerKey: 'Ports' };
  public static readonly RUNNING_FOR: DockerFormatKey = { key: 'runningFor', dockerKey: 'RunningFor' };
  public static readonly STATUS: DockerFormatKey = { key: 'status', dockerKey: 'Status' };

  public static keysToString(keys: DockerFormatKey[]): string {
    // generate code to generate a string like above
    const content = keys
      .map((key) => {
        if (key.hasQuotes) {
          return `\\"${key.key}\\":{{.${key.dockerKey}}}`;
        } else {
          return `\\"${key.key}\\":\\"{{.${key.dockerKey}}}\\"`;
        }
      })
      .join(',');

    return `{${content}}`;
  }
}

/**
 * Service to execute docker command and get result
 */
export class DockerCommand {
  private readonly logger = new Logger(DockerCommand.name);

  public async getContainerFullInfo(containerName: string): Promise<DockerPsFull> {
    // le size peut rendre la réponse trop longue
    const result = await this.runDockerPs(
      [
        DockerFormatKeys.ID,
        DockerFormatKeys.COMMAND,
        DockerFormatKeys.CREATED_AT,
        DockerFormatKeys.IMAGE,
        DockerFormatKeys.MOUNTS,
        DockerFormatKeys.NAMES,
        DockerFormatKeys.NETWORKS,
        DockerFormatKeys.PORTS,
        DockerFormatKeys.RUNNING_FOR,
        DockerFormatKeys.STATUS,
      ],
      [containerName]
    );

    if (result.length === 0) {
      throw new BadRequestException(`Container '${containerName}' not found`);
    }

    return result[0];
  }

  // specific method to get size of container
  // not included in detail because it can take a while
  public async getContainerSize(containerName: string): Promise<string> {
    const result = await this.getCommand().execCommand(
      `docker ps -s -f name=${containerName} --format "{{.Size}}"`
    );
    return result;
  }

  private async runDockerPs(format: DockerFormatKey[], containerNames: string[] = []): Promise<any[]> {
    const strFormat = DockerFormatKeys.keysToString(format);

    let command = `docker ps -a --no-trunc --format=${strFormat}`;

    if (containerNames?.length > 0) {
      const filters = containerNames.map((name) => `--filter "name=^${name}$"`).join(' ');
      command += ` ${filters}`;
    }
    // return a json like with each line separated with \n
    const result = await this.getCommand().execCommand(command);

    return result
      .split('\n')
      .filter((value) => value.length > 0)
      .map((value) => JSON.parse(value));
  }

  public async dockerInspect(containerName: string): Promise<DockerInspect> {
    // Get only State and Config as JSON objects to avoid template parsing issues with missing fields
    // eslint-disable-next-line max-len
    const strFormat = `{\\"state\\":{{json .State}},\\"name\\":{{json .Name}},\\"image\\":{{json .Config.Image}}}`;
    const result = await this.getCommand()
      .execCommand(`docker inspect ${containerName} --format="${strFormat}"`, ExecCommandMode.NO_LOG)
      .catch(() => null);

    if (result === null) return new DockerInspect(containerName, null, '0', null, null, null);

    const inspectData = JSON.parse(result);
    const state = inspectData.state?.Status || null;
    const exitCode = inspectData.state?.ExitCode?.toString() || '0';
    const image = inspectData.image || null;
    const startedAt = inspectData.state?.StartedAt || null;
    const health = inspectData.state?.Health?.Status || 'none';

    return new DockerInspect(containerName, state, exitCode, image, startedAt, health);
  }

  public async dockerInspectMultiple(containerNames: string[]): Promise<DockerComposeInspect> {
    const containers = new DockerComposeInspect();
    for (const containerName of containerNames) {
      const inspect = await this.dockerInspect(containerName);
      containers.addContainer(inspect);
    }
    return containers;
  }

  public async containerExists(containerName: string): Promise<boolean> {
    const inspect = await this.dockerInspect(containerName);
    return inspect.status !== 'none';
  }

  public async containerIsRunning(containerName: string): Promise<boolean> {
    const inspect = await this.dockerInspect(containerName);
    return inspect.isRunning();
  }

  public async getLogs(containerName: string): Promise<string> {
    // --tail 2000 : only get the last 2000 lines
    // 2>&1 : redirect stderr to stdout to get it in the result in the order it was written
    return this.getCommand().execCommand(
      `docker logs --tail 2000 ${containerName} 2>&1`,
      ExecCommandMode.STDERR_AS_SUCCESS
    );
  }

  public async getErrorLogs(containerName: string): Promise<string> {
    const inspect = await this.dockerInspect(containerName);
    // --tail 2000 : only get the last 2000 lines
    // --since : only get logs since the container started (to avoid getting old logs)
    // 2>&1 : redirect stderr to stdout to get it in the result in the order it was written
    // 1>/dev/null : redirect stdout to /dev/null to only get stderr
    return this.getCommand().execCommand(
      `docker logs --tail 2000 ${containerName} --since ${inspect.startedAt} 2>&1 1>/dev/null`,
      ExecCommandMode.STDERR_AS_SUCCESS
    );
  }

  public async exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    // 2>&1 : redirect stderr to stdout to get it in the result in the order it was written
    await this.getCommand().execCommand(`docker logs ${containerName} > ${filePath} 2>&1`);
    return filePath;
  }

  public login(username: string, password: string, registryUrl: string): Promise<string> {
    return this.getCommand().execCommand(`docker login -u ${username} -p ${password} ${registryUrl}`);
  }

  public pruneUnusedImages(): Promise<string> {
    return this.getCommand().execCommand(`docker image prune -a -f`);
  }

  public async dockerRun(
    image: string,
    containerName: string,
    options: DockerRunOptions = {}
  ): Promise<boolean> {
    let command = `docker run --name ${containerName} -d`;

    // Networks (add first network)
    if (options.networks) {
      command += ` --network ${options.networks[0]}`;
    }

    // Labels
    if (options.labels) {
      for (const network of options.labels) {
        // add label to the container wrapped in quotes
        command += ` --label '${network}'`;
      }
    }

    // Ports
    if (options.ports) {
      for (const port of options.ports) {
        command += ` -p ${port.host}:${port.container}`;
      }
    }

    // envs
    if (options.envs) {
      for (const key in options.envs) {
        command += ` -e ${key}=${options.envs[key]}`;
      }
    }

    command += ` ${image}`;
    const result = await this.getCommand().execCommand(command);

    // there is an error if the returned string is not only one work (the container id)
    if (result === '' || result.includes(' ')) {
      throw new BadRequestException(
        `Error while running container '${containerName}'. Commande : '${command}'. Error : ${result}`
      );
    }

    // add other networks later because docker doesn't support multiple network in run
    if (options.networks) {
      for (let i = 1; i < options.networks.length; i++) {
        await this.addNetworkToContainer(containerName, options.networks[i]);
      }
    }

    return true;
  }

  public async addNetworkToContainer(containerName: string, network: string): Promise<void> {
    const result = await this.getCommand().execCommand(`docker network connect ${network} ${containerName}`);
    // if there was an error
    if (result !== '') {
      throw new BadRequestException(
        `Error while connecting container '${containerName}' to network '${network}'. Error : ${result}`
      );
    }
  }

  public async dockerRmContainer(containerName: string): Promise<void> {
    const result = await this.getCommand().execCommand(`docker rm -f ${containerName}`);

    // if success the response is containerName\n
    if (result !== containerName + '\n') {
      throw new BadRequestException(`Error while removing container '${containerName}'. Error : ${result}`);
    }
  }

  public async startContainer(containerName: string): Promise<void> {
    const result = await this.getCommand().execCommand(`docker start ${containerName}`);

    // if success the response is containerName\n
    if (result !== containerName + '\n') {
      throw new BadRequestException(`Error while starting container '${containerName}'. Error : ${result}`);
    }
  }

  public async stopContainer(containerName: string): Promise<void> {
    const result = await this.getCommand().execCommand(`docker stop ${containerName}`);

    // if success the response is containerName\n
    if (result !== containerName + '\n') {
      throw new BadRequestException(`Error while stopping container '${containerName}'. Error : ${result}`);
    }
  }

  /**
   * Execute a command in a Docker container via docker exec.
   *
   * @param containerName - The container name
   * @param command - The command to execute inside the container
   * @param options - Docker exec options (user, interactive flags)
   * @param mode - How to handle stderr output
   * @param shellSuffix - Optional shell operators to append after the docker exec command
   *                      (e.g., "< /tmp/dump.sql" for stdin redirection)
   * @returns The command output
   */
  public async dockerExec(
    containerName: string,
    command: string,
    options?: DockerExecOptions,
    mode?: ExecCommandMode,
    shellSuffix?: string
  ): Promise<string> {
    let optionsStr = '';
    if (options?.interactive) {
      optionsStr += ' -i';
    }
    if (options?.user) {
      optionsStr += ` -u ${options.user}`;
    }

    const dockerExecCommand = `docker exec${optionsStr} ${containerName} ${command}`;
    const fullCommand = shellSuffix ? `${dockerExecCommand} ${shellSuffix}` : dockerExecCommand;

    return this.getCommand().execCommand(fullCommand, mode);
  }

  private getCommand(): Command {
    return new Command();
  }
}
