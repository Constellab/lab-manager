import {Injectable} from '@nestjs/common';
import {LabStatus} from './lab.class';
import {DockerService} from './docker/docker.service';
import {TaskService} from '../core/services/task/task.service';

@Injectable()
export class LabService {

  constructor(private dockerService: DockerService, private taskService: TaskService) {
  }

  public async getStatus(): Promise<LabStatus> {
    return {
      containersStatus: await this.dockerService.getContainersStatus(),
      currentTask: this.taskService.currentTask,
      adminerRunning: await this.dockerService.adminerIsRunning()
    };
  }
}
