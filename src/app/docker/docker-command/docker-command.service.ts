import {Injectable, Logger} from '@nestjs/common';
import {exec} from 'child_process';
import {DockerCommandServiceI} from './docker-command.class';

/**
 * Service to execute docker command and get result
 */
@Injectable()
export class DockerCommandService implements DockerCommandServiceI {

  private readonly logger = new Logger(DockerCommandService.name);

  public composeUp(options: string[] = []): Promise<string> {
    const command: string = 'docker-compose up -d ' + options.join(' ');
    return this.execCommand(command);
  }

  public composeDown(): Promise<string> {
    const command: string = 'docker-compose down';
    return this.execCommand(command);
  }

  public dockerPs(): Promise<string> {
    return this.execCommand(`docker ps --no-trunc --format="{{json .}},"`);
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
            this.logger.error(`Error during the execution of the command '${command}'. Error : '${stderr}'`);
            reject(stderr);
            return;
          }
          return resolve(stdout);
        });
    }));
  }
}
