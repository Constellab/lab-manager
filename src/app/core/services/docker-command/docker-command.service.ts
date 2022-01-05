import {Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';
import {CommandService} from '../command/command.service';

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
    return this.commandService.execCommand(`docker ps -a --no-trunc --format="{{json .}},"`);
  }

  public getLogs(containerName: string): Promise<string> {
    // todo get stderr & stdout
    return this.commandService.execCommand(`docker logs ${containerName}`);
  }

  login(username: string, password: string, registryUrl: string): Promise<string> {
    return this.commandService.execCommand(`docker login -u ${username} -p ${password} ${registryUrl}`);
  }
}


