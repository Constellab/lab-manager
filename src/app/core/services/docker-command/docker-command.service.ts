import {Injectable, Logger} from '@nestjs/common';
import {exec} from 'child_process';
import {DockerCommandServiceI} from './docker-command.class';

/**
 * Service to execute docker command and get result
 */
@Injectable()
export class DockerCommandService implements DockerCommandServiceI {

  private readonly logger = new Logger(DockerCommandService.name);

  public composeUp(filePath: string = 'docker-compose.yml', options: string[] = []): Promise<string> {
    const command: string = `docker-compose -f ${filePath} up -d ${options.join(' ')}`;
    return this.execCommand(command);
  }

  public composeDown(filePath: string = 'docker-compose.yml'): Promise<string> {
    const command: string = `docker-compose -f ${filePath} down`;
    return this.execCommand(command);
  }

  public dockerPs(): Promise<string> {
    return this.execCommand(`docker ps -a --no-trunc --format="{{json .}},"`);
  }

  public getLogs(containerName: string): Promise<string> {
    return this.execCommand(`docker logs ${containerName}`);
  }

  login(username: string, password: string, registryUrl: string): Promise<string> {
    return this.execCommand(`docker login -u ${username} -p ${password} ${registryUrl}`);
  }


  private execCommand(command: string): Promise<string> {
    return new Promise(((resolve, reject) => {
      exec(command,
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error during the execution of the command '${command}'. Error : '${error}'`);
            reject(error);
            return;
          }
          if (stderr) {
            if (stdout) {
              this.logger.warn(`Warning during the execution of the command '${command}'. Error : '${stderr}'`);
            } else {
              this.logger.error(`Error during the execution of the command '${command}'. Error : '${stderr}'`);
              reject(stderr);
              return;
            }
          }
          return resolve(stdout);
        });
    }));
  }
}


