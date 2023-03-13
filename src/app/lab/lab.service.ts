import {Injectable} from '@nestjs/common';
import {LabStatus} from './lab.class';
import {DockerService} from './docker/docker.service';
import {TaskService} from '../core/services/task/task.service';
import {CoreConfigService} from '../core/services/config/core-config.service';
import { ContainerService } from './container/container.service';
import { FileService } from '../core/services/file/file.service';

@Injectable()
export class LabService {

  constructor(private dockerService: DockerService,
    private taskService: TaskService,
    private configService: CoreConfigService,
    private containerService: ContainerService,
    private fileService: FileService) {
  }

  public async getStatus(): Promise<LabStatus> {
    let biotaDbUrl: string = null;
    if(this.fileService.privateFileExists()){
      biotaDbUrl = this.fileService.readPrivateFile().data?.biota_current_db_url_version;
    }
    
    return {
      containersStatus: await this.dockerService.getContainersStatus(),
      currentTask: this.taskService.currentTask,
      adminerIsRunning: await this.containerService.adminerIsRunning(),
      labManagerVersion: this.configService.getLabManagerVersion(),
      biotaDbUrl: biotaDbUrl,
    };
  }
}
