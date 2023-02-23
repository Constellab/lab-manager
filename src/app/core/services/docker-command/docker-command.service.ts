import {BadRequestException, Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';
import {CommandService, ExecCommandMode} from '../command/command.service';
import {DockerPs, DockerRunOptions} from '../../../lab/docker.class';

/**
 * Service to execute docker command and get result
 */
@Injectable()
export class DockerCommandService implements DockerCommandServiceI {


  constructor(private commandService: CommandService) {
  }

  /**
   * Call a docker compose up command
   * @param filePath
   * @param options
   * @param containers if provided, only up the containers
   */
  public composeUp(filePath: string = 'docker-compose.yml', options: string[] = [], containers: string[] = []): Promise<string> {
    const command: string = `docker-compose -f ${filePath} up -d ${options.join(' ')} ${containers.join(' ')}`;
    return this.commandService.execCommand(command);
  }

  public composePull(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} pull`;
    return this.commandService.execCommand(command);
  }

  public composeDown(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} down`;
    return this.commandService.execCommand(command);
  }

  public composeRestart(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} restart`;
    return this.commandService.execCommand(command);
  }

  public composeStop(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} stop`;
    return this.commandService.execCommand(command);
  }

  public async dockerPs(): Promise<DockerPs[]> {
    // return a json like with each line separated with e_o_f\n
    // eslint-disable-next-line max-len
    const result = await this.commandService.execCommand(`docker ps -a --no-trunc --format={\\"id\\":\\"{{.ID}}\\",\\"command\\":{{.Command}},\\"createdAt\\":\\"{{.CreatedAt}}\\",\\"image\\":\\"{{.Image}}\\",\\"mounts\\":\\"{{.Mounts}}\\",\\"names\\":\\"{{.Names}}\\",\\"networks\\":\\"{{.Networks}}\\",\\"ports\\":\\"{{.Ports}}\\",\\"runningFor\\":\\"{{.RunningFor}}\\",\\"size\\":\\"{{.Size}}\\",\\"state\\":\\"{{.State}}\\",\\"status\\":\\"{{.Status}}\\"}e_o_f`);
    return result.split('e_o_f\n').filter(value => value.length > 0).map(value => JSON.parse(value));
  }

  public async dockerContainerInfo(containerName: string): Promise<DockerPs> {
    const containers = await this.dockerPs();
    return containers.find(container => container.names === containerName);
  }

  public dockerPull(image: string): Promise<string> {
    return this.commandService.execCommand(`docker pull ${image}`);
  }

  public forceRestart(container: string, dockerRunCommand: string): Promise<string> {
    return this.commandService.execCommand(`docker stop ${container} && docker rm ${container} && ${dockerRunCommand}`);
  }

  public getLogs(containerName: string): Promise<string> {
    return this.commandService.execCommand(`docker logs --tail 2000 ${containerName}`, ExecCommandMode.STDERR_AS_SUCCESS);
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

}


