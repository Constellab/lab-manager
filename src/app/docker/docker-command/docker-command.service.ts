import {BadRequestException, Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';
import { CommandService, ExecCommandMode } from 'src/app/core/services/command/command.service';
import { FileService } from 'src/app/core/services/file/file.service';
import { DockerPs, DockerPsFull, DockerRunOptions } from '../docker.class';


/**
 * Service to execute docker command and get result
 */
@Injectable()
export class DockerCommandService implements DockerCommandServiceI {


  constructor(private commandService: CommandService,
    private fileService: FileService) {
  }

  //////////////////////////////// DOCKER COMPOSE ////////////////////////////////

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
    const composePath = this.fileService.dockerComposePath;
    const envPath = this.fileService.envFilePath;
    const command: string = `docker compose -f ${composePath} --env-file ${envPath} ${options}`;
    return this.commandService.execCommand(command);
  }
  //////////////////////////////// DOCKER ////////////////////////////////

  public async getContainerInfo(containerName: string): Promise<DockerPsFull> {
    // le size peut rendre la réponse trop longue
    const result = await this.runDockerPs(`{\\"id\\":\\"{{.ID}}\\",\\"command\\":{{.Command}},\\"createdAt\\":\\"{{.CreatedAt}}\\",`+ 
      `\\"image\\":\\"{{.Image}}\\",\\"mounts\\":\\"{{.Mounts}}\\",\\"names\\":\\"{{.Names}}\\",\\"networks\\":\\"{{.Networks}}\\",`+
      `\\"ports\\":\\"{{.Ports}}\\",\\"runningFor\\":\\"{{.RunningFor}}\\",\\"state\\":\\"{{.State}}\\",\\"status\\":\\"{{.Status}}\\"}`,
    containerName);

    if (result.length === 0) {
      throw new BadRequestException(`Container '${containerName}' not found`);
    }

    return result[0];
  }

  // specific method to get size of container
  // not included in detail because it can take a while
  public async getContainerSize(containerName: string): Promise<string> {
    const result = await this.commandService.execCommand(`docker ps -s -f name=${containerName} --format "{{.Size}}"`);
    return result;
  }

  public async dockerPs(): Promise<DockerPs[]> {
    return this.runDockerPs(`{\\"names\\":\\"{{.Names}}\\",\\"state\\":\\"{{.State}}\\"}`);
  }

  private async runDockerPs(format: string, containerName: string = null): Promise<any[]> {

    let command = `docker ps -a --no-trunc --format=${format}`;

    if (containerName) {
      command += ` -f name=${containerName}`;
    }
    // return a json like with each line separated with \n
    const result = await this.commandService.execCommand(command);

    return result.split('\n').filter(value => value.length > 0).map(value => JSON.parse(value));
  }

  public async dockerContainerInfo(containerName: string): Promise<DockerPs> {
    const containers = await this.dockerPs();
    return containers.find(container => container.names === containerName);
  }

  public getLogs(containerName: string): Promise<string> {
    // --timestamps : add timestamps to logs
    // --tail 2000 : only get the last 2000 lines
    // 2>&1 : redirect stderr to stdout to get it in the result in the order it was written
    return this.commandService.execCommand(`docker logs --timestamps --tail 2000 ${containerName} 2>&1`, ExecCommandMode.STDERR_AS_SUCCESS);
  }

  public async exportLogsToFile(containerName: string, filePath: string): Promise<string> {
    // --timestamps : add timestamps to logs
    // 2>&1 : redirect stderr to stdout to get it in the result in the order it was written
    await this.commandService.execCommand(`docker logs --timestamps ${containerName} > ${filePath} 2>&1`);
    return filePath;
  }

  public login(username: string, password: string, registryUrl: string): Promise<string> {
    return this.commandService.execCommand(`docker login -u ${username} -p ${password} ${registryUrl}`);
  }

  public systemPrune(): Promise<string> {
    return this.commandService.execCommand(`docker system prune -f -a`);
  }

  public async dockerRun(image: string, containerName: string, options: DockerRunOptions = {}): Promise<boolean> {
    let command = `docker run --name ${containerName} -d`;

    // Networks (add first network)
    if (options.networks) {
      command += ` --network ${options.networks[0]}`;
    }

    // Labels
    if (options.labels) {
      for (const network of options.labels) {
        command += ` --label ${network}`;
      }
    }

    command += ` ${image}`;
    const result = await this.commandService.execCommand(command);

    // there is an error if the returned string is not only one work (the container id)
    if (result === '' || result.includes(' ')) {
      throw new BadRequestException(`Error while running container '${containerName}'. Commande : '${command}'. Error : ${result}`);
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
    const result = await this.commandService.execCommand(`docker network connect ${network} ${containerName}`);
    // if there was an error
    if (result !== '') {
      throw new BadRequestException(`Error while connecting container '${containerName}' to network '${network}'. Error : ${result}`);
    }
  }

  public async dockerRmContainer(containerName: string): Promise<void> {
    const result = await this.commandService.execCommand(`docker rm -f ${containerName}`);

    // if success the response is containerName\n
    if( result !== containerName + '\n'){
      throw new BadRequestException(`Error while removing container '${containerName}'. Error : ${result}`);
    }
  }

  public async stopContainer(containerName: string): Promise<void> {
    const result = await this.commandService.execCommand(`docker stop ${containerName}`);

    // if success the response is containerName\n
    if( result !== containerName + '\n'){
      throw new BadRequestException(`Error while stopping container '${containerName}'. Error : ${result}`);
    }
  }

  public async dockerExec(containerName: string, command: string, mode?: ExecCommandMode): Promise<string> {
    return this.commandService.execCommand(`docker exec ${containerName} ${command}`, mode);
  }

}


