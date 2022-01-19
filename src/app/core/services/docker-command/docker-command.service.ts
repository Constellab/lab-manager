import {Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';
import {CommandService, ExecCommandMode} from '../command/command.service';

/**
 * Service to execute docker command and get result
 */
@Injectable()
export class DockerCommandService implements DockerCommandServiceI {


  constructor(private commandService: CommandService) {
  }

  public composeUp(filePath: string = 'docker-compose.yml', options: string[] = []): Promise<string> {
    const command: string = `docker-compose -f ${filePath} up -d ${options.join(' ')}`;
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

  public composeStop(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} stop`;
    return this.commandService.execCommand(command);
  }

  public dockerPs(): Promise<string> {
    // return a json like with each line separated with e_o_f\n
    // eslint-disable-next-line max-len
    return this.commandService.execCommand(`docker ps -a --no-trunc --format={\\"id\\":\\"{{.ID}}\\",\\"command\\":{{.Command}},\\"createdAt\\":\\"{{.CreatedAt}}\\",\\"image\\":\\"{{.Image}}\\",\\"mounts\\":\\"{{.Mounts}}\\",\\"names\\":\\"{{.Names}}\\",\\"networks\\":\\"{{.Networks}}\\",\\"ports\\":\\"{{.Ports}}\\",\\"runningFor\\":\\"{{.RunningFor}}\\",\\"size\\":\\"{{.Size}}\\",\\"state\\":\\"{{.State}}\\",\\"status\\":\\"{{.Status}}\\"}e_o_f`);
  }

  public dockerPull(image: string): Promise<string> {
    return this.commandService.execCommand(`docker pull ${image}`);
  }

  public forceRestart(container: string, dockerRunCommand: string): Promise<string> {
    return this.commandService.execCommand(`docker stop ${container} && docker rm ${container} && ${dockerRunCommand}`);
  }

  public getLogs(containerName: string): Promise<string> {
    return this.commandService.execCommand(`docker logs ${containerName}`, ExecCommandMode.STDERR_AS_SUCCESS);
  }

  public login(username: string, password: string, registryUrl: string): Promise<string> {
    return this.commandService.execCommand(`docker login -u ${username} -p ${password} ${registryUrl}`);
  }

  public systemPrune(): Promise<string> {
    return this.commandService.execCommand(`docker system prune -f`);
  }



}


