import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BehaviorSubject, filter, Observable } from 'rxjs';
import { TaskStatus, TaskStatusInfo } from '../../models/task.class';

/**
 * Singleton shared across the app to store the current task with its status and prevent
 * creating a new task if a previous one is running
 */
@Injectable()
export class TaskService {

  private task$: BehaviorSubject<TaskStatusInfo> = new BehaviorSubject<TaskStatusInfo>(null);

  private readonly logger = new Logger(TaskService.name);

  public getTask$(): Observable<TaskStatusInfo> {
    return this.task$.asObservable().pipe(filter(task => task != null));
  }

  public get currentTask(): TaskStatusInfo | null {
    return this.task$.value;
  }

  public newTask(name: string, info?: string): void {
    if (this.currentTask != null && this.currentTask.status === 'RUNNING') {
      // eslint-disable-next-line max-len
      throw new BadRequestException(`Can't start the task ${name} because the task ${this.currentTask.name} is still running, please wait for this task to finish before running a new task`);
    }

    this.task$.next({
      status: 'RUNNING',
      name: name,
      info: info
    });

    let log = `New task '${name}'`;
    if (info != null) {
      log += `, info : '${info}'`;
    }
    this.logger.log(log);
  }

  public markTaskAsError(name: string, info: string,
    logMessage: boolean = true
  ): void {
    this.updateTask(name, 'ERROR', info, logMessage);
  }

  public markTaskAsSuccess(name: string, info?: string,
    logMessage: boolean = true
  ): void {
    this.updateTask(name, 'SUCCESS', info, logMessage);
  }

  public updateTaskInfo(name: string, info: string,
    logMessage: boolean = true
  ): void {
    this.updateTask(name, this.currentTask.status, info, logMessage);
  }

  public updateTask(name: string, status: TaskStatus, info?: string,
    logMessage: boolean = true): void {
    if (this.currentTask == null) {
      throw new BadRequestException(`There is no running task`);
    }

    if (this.currentTask.name != name || this.currentTask.status !== 'RUNNING') {
      throw new BadRequestException(`The task ${name} is not running`);
    }

    this.task$.next({
      name: name,
      status: status,
      info: info,
    });

    let log = `Update task '${name}' to '${status}'`;
    if (info) {
      log += `, info : '${info}'`;
    }

    if(logMessage){
      if (status == 'ERROR') {
        this.logger.error(log);
      } else {
        this.logger.log(log);
      }
    }
  }

  public forceStopCurrentTask(): void {
    if (this.currentTask == null || this.currentTask.status !== 'RUNNING') {
      throw new BadRequestException(`There is no running task`);
    }

    this.task$.next({
      name: this.currentTask.name,
      status: 'ERROR',
      info: 'Stopped manually'
    });

    this.logger.log(`Manually stopping task '${this.currentTask.name}'`);
  }
}
