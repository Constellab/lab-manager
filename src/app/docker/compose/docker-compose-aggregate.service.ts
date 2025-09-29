import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from '../../core/services/task/task.service';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from '../docker.class';
import { DockerComposeService } from './docker-compose.service';
import { ComposeList } from './sub-compose-manager';

@Injectable()
export class DockerComposeAggregateService {
  constructor(
    private dockerComposeService: DockerComposeService,
    private taskService: TaskService,
    private configFileService: ConfigFileService,
    private fileService: FileService
  ) {}

  public getAllComposes(): ComposeList {
    return this.dockerComposeService.getAllComposes();
  }

  public async listServices(brick_name: string, unique_name: string): Promise<DockerInspect[]> {
    if (
      brick_name === DockerComposeService.SYSTEM_COMPOSE_BRICK &&
      unique_name === DockerComposeService.SYSTEM_COMPOSE_UNIQUE
    ) {
      return this.dockerComposeService.inspectSystemCompose();
    }
    await this.checkLabIsConfigured();
    const compose = this.dockerComposeService.getAndCheckDockerCompose(brick_name, unique_name);
    const inspect = await compose.composeInspect();
    return inspect.getContainers();
  }

  public async pullServicesTask(brick_name: string, unique_name: string): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Update services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.getAndCheckDockerCompose(brick_name, unique_name);
      const result = await mainCompose.composePull();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async upServicesTask(
    brick_name: string,
    unique_name: string,
    options: ComposeUpOptions
  ): Promise<void> {
    if (options.updateContainers) {
      await this.pullServicesTask(brick_name, unique_name);
    }

    await this.upServicesTaskCommand(brick_name, unique_name);
  }

  public async upServicesTaskCommand(
    brick_name: string,
    unique_name: string,
    services: string[] = []
  ): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Start services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.getAndCheckDockerCompose(brick_name, unique_name);
      const result = await mainCompose.composeUp([], services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopServicesTask(
    brick_name: string,
    unique_name: string,
    services: string[] = []
  ): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Stop services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.getAndCheckDockerCompose(brick_name, unique_name);
      const result = await mainCompose.composeStop(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteServicesTask(
    brick_name: string,
    unique_name: string,
    services: string[] = []
  ): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Delete services';
    this.taskService.newTask(taskName);

    try {
      const mainCompose = this.dockerComposeService.getAndCheckDockerCompose(brick_name, unique_name);
      const result = await mainCompose.composeDown(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async restartServicesTask(
    brick_name: string,
    unique_name: string,
    options: ComposeRestartOptions
  ): Promise<void> {
    await this.checkLabIsConfigured();
    if (options.updateContainers) {
      await this.pullServicesTask(brick_name, unique_name);
    }

    if (options.destroyContainers) {
      await this.deleteServicesTask(brick_name, unique_name);

      await this.upServicesTaskCommand(brick_name, unique_name);
    } else {
      // do a stop and a up because if a new image is available
      // with same tag, restart doesn't update it. Stop and up does.
      await this.stopServicesTask(brick_name, unique_name);
      await this.upServicesTaskCommand(brick_name, unique_name);
    }
  }

  public async checkLabIsConfigured(): Promise<void> {
    if (!this.configFileService.configFileExists()) {
      throw new BadRequestException(
        'The lab bricks are not configured. Please configure the lab before calling this method'
      );
    }

    if (!this.fileService.privateFileExists()) {
      throw new BadRequestException(
        'The lab is not initialized. Please initialize the lab before calling this method'
      );
    }

    if (!this.fileService.exists(this.fileService.dockerComposePath)) {
      throw new BadRequestException(
        'The docker compose file was not generated. Please initialize the lab before calling this method'
      );
    }

    if (!this.fileService.exists(this.fileService.envFilePath)) {
      throw new BadRequestException(
        'The env file was not generated. Please initialize the lab before calling this method'
      );
    }
  }

  ///////////////////////////////// MAIN FILE //////////////////////////////////////

  public async pullMainServices(): Promise<void> {
    return this.pullServicesTask(
      DockerComposeService.MAIN_COMPOSE_BRICK,
      DockerComposeService.MAIN_COMPOSE_UNIQUE
    );
  }

  public async restartMainServices(options: ComposeRestartOptions): Promise<void> {
    return this.restartServicesTask(
      DockerComposeService.MAIN_COMPOSE_BRICK,
      DockerComposeService.MAIN_COMPOSE_UNIQUE,
      options
    );
  }
}
