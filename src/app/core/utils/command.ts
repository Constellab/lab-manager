import { Logger } from '@nestjs/common';
import { ChildProcess, exec, execFile, spawn } from 'child_process';
import { Observable } from 'rxjs';

export interface SpawnResult {
  status: 'success' | 'error';
  data: string;
}

export interface SpawnResponse {
  childProcess: ChildProcess;
  observable: Observable<SpawnResult>;
}

export enum ExecCommandMode {
  STDERR_AS_ERROR, // reject promis when stderr is not empty
  STDERR_AS_WARNING, // on stderr, log warning and return stdout
  STDERR_AS_SUCCESS, // consider STDERR as success and return stdout and stderr
  NO_LOG, // do not log anything
}

/**
 * Service to execute shell commands and scripts
 */
export class Command {
  private readonly logger = new Logger(Command.name);

  /**
   * Execute a command and return the result once the command is finished
   * @param command command to execute
   * @param mode mode to handle stderr
   */
  public execCommand(
    command: string,
    mode: ExecCommandMode = ExecCommandMode.STDERR_AS_WARNING
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error && mode !== ExecCommandMode.NO_LOG) {
          this.logger.error(`Error during the execution of the command '${command}'. Error : '${error}'`);
          reject(error);
          return;
        }

        // TODO handle no log
        switch (mode) {
          case ExecCommandMode.STDERR_AS_SUCCESS:
            resolve(stdout + stderr);
            return;
          case ExecCommandMode.STDERR_AS_WARNING:
            if (stderr) {
              this.logger.warn(
                `Warning during the execution of the command '${command}'. Error : '${stderr}'`
              );
            }
            resolve(stdout);
            return;
          case ExecCommandMode.STDERR_AS_ERROR:
            if (stderr) {
              this.logger.error(
                `Error during the execution of the command '${command}'. Error : '${stderr}'`
              );
              reject(stderr);
              return;
            }
            resolve(stdout);
            return;
          default:
            if (stderr) {
              reject(stderr);
            } else {
              resolve(stdout);
            }
            return;
        }
      });
    });
  }

  public spawn(command: string, args: string[] = []): SpawnResponse {
    const spawnCommand = spawn(command, args);
    const obs: Observable<SpawnResult> = new Observable((subscriber) => {
      let lastError: string;

      spawnCommand.stdout.on('data', (data) => {
        subscriber.next({
          status: 'success',
          data: data.toString(),
        });
      });

      spawnCommand.stderr.on('data', (data) => {
        subscriber.next({
          status: 'error',
          data: data.toString(),
        });
        lastError = data.toString();
      });

      spawnCommand.on('exit', (code: number, signal: NodeJS.Signals | null) => {
        console.log('EXIT ' + code, +' ' + signal);

        if (code === 0) {
          subscriber.complete();
        } else {
          subscriber.error({
            status: 'error',
            data: `Code : ${code} - Signal : ${signal} - Error : ${lastError}`,
          });
        }
      });
    });

    return {
      childProcess: spawnCommand,
      observable: obs,
    };
  }

  public execFile(file: string, options: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(file, options, (error, stdout, stderr) => {
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
    });
  }
}
