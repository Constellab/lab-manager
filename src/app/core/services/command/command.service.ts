import {Injectable, Logger} from '@nestjs/common';
import {exec, execFile, spawn} from 'child_process';
import {Observable} from 'rxjs';

export interface SpawnResult {
  status: 'success' | 'error';
  data: string;
}

/**
 * Service to execute shell commands and scripts
 */
@Injectable()
export class CommandService {

  private readonly logger = new Logger(CommandService.name);

  /**
   * Execute a command and return the result once the command is finished
   * @param command command to execute
   * @param ignoreStderr if true, the stderr are only logged and the command is not considered as error
   */
  public execCommand(command: string, ignoreStderr: boolean = true): Promise<string> {
    return new Promise(((resolve, reject) => {
      exec(command,
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error during the execution of the command '${command}'. Error : '${error}'`);
            reject(error);
            return;
          }
          if (stderr) {
            if (ignoreStderr) {
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

  public spawn(command: string, args: string[]): Observable<SpawnResult> {
    return new Observable(subscriber => {
      const spawnCommand = spawn(command, args);

      spawnCommand.stdout.on('data', (data) => {
        subscriber.next({
          status: 'success',
          data: data.toString()
        });
      });

      spawnCommand.stderr.on('data', (data) => {
        subscriber.next({
          status: 'error',
          data: data.toString()
        });
      });

      spawnCommand.on('exit', (code, signal) => {
        console.log('EXIT ' + code, +' ' + signal);
        subscriber.complete();
      });
    });
  }

  public execFile(file: string, options: string[] = []): Promise<string> {
    return new Promise(((resolve, reject) => {
      execFile(file, options,
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error during the execution of the file '${file}'. Error : '${error}'`);
            reject(error);
            return;
          }
          if (stderr) {
            if (stdout) {
              this.logger.warn(`Warning during the execution of the file '${file}'. Error : '${stderr}'`);
            } else {
              this.logger.error(`Error during the execution of the file '${file}'. Error : '${stderr}'`);
              reject(stderr);
              return;
            }
          }
          return resolve(stdout);
        });
    }));
  }
}
