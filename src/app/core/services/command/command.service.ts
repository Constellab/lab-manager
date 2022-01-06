import {Injectable, Logger} from '@nestjs/common';
import {exec, execFile, spawn} from 'child_process';
import {Observable} from 'rxjs';

export interface SpawnResult {
  status: 'success' | 'error';
  data: string;
}

export enum ExecCommandMode {
  STDERR_AS_ERROR, // reject promis when stderr is not empty
  STDERR_AS_WARNING, // on stderr, log warning and return stdout
  STDERR_AS_SUCCESS // consider STDERR as success and return stdout and stderr
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
   * @param mode mode to handle stderr
   */
  public execCommand(command: string, mode: ExecCommandMode = ExecCommandMode.STDERR_AS_WARNING): Promise<string> {
    return new Promise(((resolve, reject) => {
      exec(command,
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error during the execution of the command '${command}'. Error : '${error}'`);
            reject(error);
            return;
          }

          switch (mode) {
            case ExecCommandMode.STDERR_AS_SUCCESS:
              return stdout + stderr;
            case ExecCommandMode.STDERR_AS_WARNING:
              if (stderr) {
                this.logger.warn(`Warning during the execution of the command '${command}'. Error : '${stderr}'`);
              }
              return stdout;
            case ExecCommandMode.STDERR_AS_ERROR:
              if (stderr) {
                this.logger.error(`Error during the execution of the command '${command}'. Error : '${stderr}'`);
                reject(stderr);
              }
              return resolve(stdout);
          }
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
