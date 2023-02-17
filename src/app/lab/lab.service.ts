import {Injectable} from '@nestjs/common';
import {LabStatus} from './lab.class';
import {DockerService} from './docker/docker.service';
import {TaskService} from '../core/services/task/task.service';
import {CoreConfigService} from '../core/services/config/core-config.service';

@Injectable()
export class LabService {

  constructor(private dockerService: DockerService,
    private taskService: TaskService,
    private configService: CoreConfigService) {
  }

  public async getStatus(): Promise<LabStatus> {
    return {
      containersStatus: await this.dockerService.getContainersStatus(),
      currentTask: this.taskService.currentTask,
      adminerIsRunning: await this.dockerService.adminerIsRunning(),
      labManagerVersion: this.configService.getLabManagerVersion()
    };
  }
}
