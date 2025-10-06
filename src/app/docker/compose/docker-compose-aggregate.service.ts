import { BadRequestException, Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from '../../core/services/task/task.service';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from '../docker.class';
import { DockerComposeStatusInfo } from './docker-compose-inspect.class';
import { DockerComposeYaml } from './docker-compose-yaml';
import {
  RegisterComposeFromZipRequestDTO,
  RegisterComposeRequestDTO,
  RegisterSQLDBComposeRequestDTO,
  RegisterSQLDBComposeResponseDTO,
} from './docker-compose.dto';
import { DockerComposeService } from './docker-compose.service';
import { ComposeList } from './sub-compose-manager';

@Injectable()
export class DockerComposeAggregateService {
  private static readonly MARIADB_IMAGE = 'mariadb:10.7.4';

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

  ///////////////////////////////// SUB COMPOSE  //////////////////////////////////////

  /**
   * Register and start a sub compose.
   * @param composeContent docker compose file content as string
   * @param brickName The brick name.
   * @param uniqueName The unique name.
   * @returns
   */
  public async registerAndStartSubCompose(
    composeRequest: RegisterComposeRequestDTO,
    brickName: string,
    uniqueName: string
  ): Promise<void> {
    if (!composeRequest.composeContent) {
      throw new Error('The compose content is required');
    }
    const composeYaml = new DockerComposeYaml(composeRequest.composeContent, brickName, uniqueName);
    return this.dockerComposeService.registerAndStartSubCompose(
      composeYaml,
      composeRequest.description,
      composeRequest.env,
      true
    );
  }

  public async unregisterSubCompose(brickName: string, uniqueName: string): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeService.unregisterDockerCompose(brickName, uniqueName);
  }

  public async getSubComposeStatus(brickName: string, uniqueName: string): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeService.getComposeStatus(brickName, uniqueName);
  }

  public getAllSubComposes(): ComposeList {
    return this.dockerComposeService.getAllSubComposes();
  }

  public getComposeContent(brickName: string, uniqueName: string): string {
    return this.dockerComposeService.getComposeContent(brickName, uniqueName);
  }

  /**
   * Register and start a sub-compose from a zip file
   * @param brickName The brick name
   * @param uniqueName The unique name
   * @param zipBuffer The zip file buffer
   * @param description Description of the compose
   * @returns Status information after registration and startup
   */
  public async registerSubComposeFromZip(
    brickName: string,
    uniqueName: string,
    zipBuffer: Buffer,
    body: RegisterComposeFromZipRequestDTO
  ): Promise<void> {
    let tempDir: string | null = null;

    try {
      // Create temporary directory for extraction
      tempDir = mkdtempSync(join(tmpdir(), 'docker-compose-zip-'));

      // Extract zip file using unzip command
      const zipPath = join(tempDir, 'upload.zip');
      const extractDir = join(tempDir, 'extracted');

      // Write zip buffer to temporary file
      writeFileSync(zipPath, zipBuffer as any);

      // Extract zip file
      execSync(`mkdir -p "${extractDir}" && unzip -q "${zipPath}" -d "${extractDir}"`, {
        encoding: 'utf-8',
      });

      // Register the sub-compose from the extracted directory
      await this.dockerComposeService.registerSubComposeFromDirectory(
        brickName,
        uniqueName,
        extractDir,
        body.description,
        body.env
      );
    } finally {
      // Clean up temporary directory
      if (tempDir) {
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Failed to clean up temporary directory ${tempDir}:`, error);
        }
      }
    }
  }

  ///////////////////////////////// SPECIFIC SERVICES //////////////////////////////////////

  public async registerSQLDBCompose(
    brickName: string,
    uniqueName: string,
    request: RegisterSQLDBComposeRequestDTO
  ): Promise<RegisterSQLDBComposeResponseDTO> {
    const composeYamlContent = `
services:
  mariadb:
    image: ${DockerComposeAggregateService.MARIADB_IMAGE}
    command: --max_allowed_packet=256M
    environment:
      - MYSQL_ROOT_PASSWORD=${request.password}
      - MYSQL_USER=${request.username}
      - MYSQL_PASSWORD=${request.password}
      - MYSQL_DATABASE=${request.database}
    container_name: \${CONTAINER_PREFIX}-db
    networks:
      - \${LAB_NETWORK}
    volumes:
      - \${LAB_VOLUME_HOST}:/var/lib/mysql
`;

    const composeYaml = new DockerComposeYaml(composeYamlContent, brickName, uniqueName);

    await this.dockerComposeService.registerAndStartSubCompose(composeYaml, request.description, null, false);

    // wait for the mariadb service to be ready
    const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(brickName, uniqueName);
    await dockerCompose.waitForServiceToBeReady('mariadb');

    const status = await dockerCompose.getStatus();
    return {
      dbHost: composeYaml.getContainerNameFromService('mariadb'),
      status,
    };
  }
}
