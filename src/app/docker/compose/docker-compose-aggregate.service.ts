import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from '../../core/services/task/task.service';
import { Command } from '../../core/utils/command';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from '../docker.class';
import { DockerComposeYaml } from './docker-compose-yaml';
import {
  RegisterComposeRequestDTO,
  RegisterComposeRequestOptionsDTO,
  RegisterSQLDBComposeRequestDTO,
  RegisterSQLDBComposeResponseDTO,
} from './docker-compose.dto';
import { DockerComposeService } from './docker-compose.service';
import { ComposeList, ComposeStatus, DockerComposeUniqueId } from './docker-compose.types';

@Injectable()
export class DockerComposeAggregateService implements OnModuleInit {
  private readonly logger = new Logger(DockerComposeAggregateService.name);
  private static readonly MARIADB_IMAGE = 'mariadb:10.7.4';

  constructor(
    private dockerComposeService: DockerComposeService,
    private taskService: TaskService,
    private configFileService: ConfigFileService,
    private fileService: FileService,
    private coreConfigService: CoreConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.removeErrorSubComposes();
    await this.initializeSubComposesWithAutoStart();
  }

  public getAllComposes(): ComposeList {
    return this.dockerComposeService.getAllComposes();
  }

  public async listServices(composeId: DockerComposeUniqueId): Promise<DockerInspect[]> {
    if (
      composeId.brickName === DockerComposeService.SYSTEM_COMPOSE_ID.brickName &&
      composeId.uniqueName === DockerComposeService.SYSTEM_COMPOSE_ID.uniqueName
    ) {
      return this.dockerComposeService.inspectSystemCompose();
    }
    await this.checkLabIsConfigured();
    const compose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
    const inspect = await compose.composeInspect();
    return inspect.getContainers();
  }

  public async pullServicesTask(composeId: DockerComposeUniqueId): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Update services';
    this.taskService.newTask(taskName);

    try {
      const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
      const result = await dockerCompose.composePull();
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async pullServicesTaskWithCatch(composeId: DockerComposeUniqueId): Promise<void> {
    try {
      await this.pullServicesTask(composeId);
    } catch (e) {
      this.logger.error('Error while pulling images: ' + e.message);
      this.logger.error(e.stack);
    }
  }

  public async upServicesTask(composeId: DockerComposeUniqueId, options: ComposeUpOptions): Promise<void> {
    if (options.updateContainers) {
      await this.pullServicesTaskWithCatch(composeId);
    }

    await this.upServicesTaskCommand(composeId, options.services || []);
  }

  public async upServicesTaskCommand(
    composeId: DockerComposeUniqueId,
    services: string[] = []
  ): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Start services';
    this.taskService.newTask(taskName);

    try {
      const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
      const result = await dockerCompose.composeUp([], services);

      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async stopServicesTask(composeId: DockerComposeUniqueId, services: string[] = []): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Stop services';
    this.taskService.newTask(taskName);

    try {
      const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
      const result = await dockerCompose.composeStop(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteServicesTask(composeId: DockerComposeUniqueId, services: string[] = []): Promise<void> {
    await this.checkLabIsConfigured();
    const taskName = 'Delete services';
    this.taskService.newTask(taskName);

    try {
      const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
      const result = await dockerCompose.composeDown(services);
      this.taskService.markTaskAsSuccess(taskName, result);
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async restartServicesTask(
    composeId: DockerComposeUniqueId,
    options: ComposeRestartOptions
  ): Promise<void> {
    await this.checkLabIsConfigured();
    if (options.updateContainers) {
      await this.pullServicesTaskWithCatch(composeId);
    }

    if (options.destroyContainers) {
      await this.deleteServicesTask(composeId);
    } else {
      // do a stop and a up because if a new image is available
      // with same tag, restart doesn't update it. Stop and up does.
      await this.stopServicesTask(composeId);
    }
    await this.upServicesTaskCommand(composeId);
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

  public async restartMainServices(options: ComposeRestartOptions): Promise<void> {
    return this.restartServicesTask(DockerComposeService.MAIN_COMPOSE_ID, options);
  }

  ///////////////////////////////// SUB COMPOSE  //////////////////////////////////////

  /**
   * Register and start a sub compose.
   * @param composeContent docker compose file content as string
   * @param brickName The brick name.
   * @param uniqueName The unique name.
   * @param env The environment.
   * @returns
   */
  public async registerAndStartSubCompose(
    composeRequest: RegisterComposeRequestDTO,
    composeId: DockerComposeUniqueId
  ): Promise<void> {
    if (!composeRequest.compose_yaml_content) {
      throw new Error('The compose content is required');
    }

    const composeYaml = new DockerComposeYaml(composeRequest.compose_yaml_content, composeId);
    return this.dockerComposeService.registerAndStartSubCompose(
      composeYaml,
      {
        description: composeRequest.options.description,
        autoStart: composeRequest.options.auto_start,
        envVariables: composeRequest.options.environment_variables,
      },
      true
    );
  }

  public async unregisterSubCompose(composeId: DockerComposeUniqueId): Promise<ComposeStatus> {
    await this.dockerComposeService.unregisterDockerCompose(composeId);

    return await this.getComposeStatus(composeId);
  }

  public async getComposeStatus(composeId: DockerComposeUniqueId): Promise<ComposeStatus> {
    const composeStatus = await this.dockerComposeService.getComposeStatus(composeId);
    const process = this.dockerComposeService.getSubComposeProcess(composeId);

    return {
      composeStatus,
      subComposeProcess: process,
    };
  }

  public async stopSubComposeProcess(composeId: DockerComposeUniqueId): Promise<ComposeStatus> {
    this.dockerComposeService.stopSubComposeProcess(composeId);
    return await this.getComposeStatus(composeId);
  }

  public getAllSubComposes(): ComposeList {
    return this.dockerComposeService.getAllSubComposes();
  }

  public getComposeContent(composeId: DockerComposeUniqueId): string {
    return this.dockerComposeService.getComposeContent(composeId);
  }

  /**
   * Register and start a sub-compose from a zip file
   * @param brickName The brick name
   * @param uniqueName The unique name
   * @param env The environment
   * @param zipBuffer The zip file buffer
   * @param description Description of the compose
   * @returns Status information after registration and startup
   */
  public async registerSubComposeFromZip(
    composeId: DockerComposeUniqueId,
    zipBuffer: Buffer,
    body: RegisterComposeRequestOptionsDTO
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
      await this.dockerComposeService.registerSubComposeFromDirectory(composeId, extractDir, {
        description: body.description,
        autoStart: body.auto_start,
        envVariables: body.environment_variables,
      });
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

  ///////////////////////////////// SUB COMPOSE SERVICE //////////////////////////////////////

  public async getSubComposeServiceStatus(
    composeId: DockerComposeUniqueId,
    serviceName: string
  ): Promise<DockerInspect> {
    const compose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
    return compose.inspectService(serviceName);
  }
  ///////////////////////////////// SPECIFIC SERVICES //////////////////////////////////////

  public async registerSQLDBCompose(
    composeId: DockerComposeUniqueId,
    request: RegisterSQLDBComposeRequestDTO
  ): Promise<RegisterSQLDBComposeResponseDTO> {
    // if the backup is disabled, use the no-backup volume variable
    // so the volume will be stored in .sys/brick-data
    const volumeVar = request.options.disable_volume_backup
      ? DockerComposeYaml.LAB_VOLUME_HOST_NO_BACKUP_VAR_NAME
      : DockerComposeYaml.LAB_VOLUME_HOST_VAR_NAME;

    const volumeSubPath = request.options.volume_sub_directory
      ? `/${request.options.volume_sub_directory.replace(/^\/+/, '')}` // clean leading slashes
      : '';

    const networkVar = request.options.all_environments_networks
      ? DockerComposeYaml.LAB_NETWORK_ALL_VAR_NAME
      : DockerComposeYaml.LAB_NETWORK_VAR_NAME;
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
      - ${networkVar}
    volumes:
      - ${volumeVar}${volumeSubPath}:/var/lib/mysql
`;

    const dockerYaml = new DockerComposeYaml(composeYamlContent, composeId);
    await this.dockerComposeService.registerAndStartSubCompose(dockerYaml, {
      description: request.options.description,
      autoStart: request.options.auto_start,
      envVariables: request.options.environment_variables,
    });

    // wait for the mariadb service to be ready
    const dockerCompose = this.dockerComposeService.getAndCheckDockerCompose(composeId);
    await dockerCompose.waitForServiceToBeReady('mariadb');

    const status = await dockerCompose.getStatus();
    return {
      dbHost: dockerCompose.getComposeYaml().getContainerNameFromService('mariadb'),
      status,
    };
  }

  ///////////////////////////////// ON START //////////////////////////////////////
  private async initializeSubComposesWithAutoStart(): Promise<void> {
    if (!this.coreConfigService.getAutoStartSubComposes()) {
      this.logger.log('Auto start of sub-composes is disabled');
      return;
    }

    this.logger.log('Checking for sub-composes with autoStart enabled');
    const subComposes = this.dockerComposeService.getAllSubComposes();

    for (const composeInfo of subComposes.composes) {
      try {
        const composeId: DockerComposeUniqueId = {
          brickName: composeInfo.brickName,
          uniqueName: composeInfo.uniqueName,
          env: composeInfo.env,
        };

        const dockerCompose = this.dockerComposeService.getDockerCompose(composeId);
        if (!dockerCompose) {
          this.logger.warn(
            `Sub-compose ${composeInfo.brickName}:${composeInfo.uniqueName}:${composeInfo.env} not found`
          );
          continue;
        }

        const autoStart = dockerCompose.getComposeYaml().getAutoStart();
        if (autoStart) {
          this.logger.log(
            `Auto-starting sub-compose ${composeInfo.brickName}:${composeInfo.uniqueName}:${composeInfo.env}`
          );

          // Start compose in background
          await dockerCompose.composeUp();

          this.logger.log(
            `Sub-compose ${composeInfo.brickName}:${composeInfo.uniqueName}:${composeInfo.env} started`
          );
        }
      } catch (e) {
        this.logger.error('Error while initializing sub-composes with autoStart', e);
      }
    }
  }

  public async removeErrorSubComposes(): Promise<void> {
    const subComposeFolders = this.dockerComposeService.subComposeManager.getAllSubFolders();

    const command = new Command();
    for (const composeInfo of subComposeFolders) {
      try {
        if (!composeInfo.dockerComposeFileExists()) {
          // if the docker-compose.yml file doesn't exist, remove the folder
          this.logger.warn(
            `Removing sub-compose folder ${composeInfo.path} ` +
              `because it doesn't contain a docker-compose.yml file`
          );
          // use a sudo because it might have some sub folder created with root permissions (like volumes)
          await command.execCommand(`sudo rm -rf "${composeInfo.path}"`);
          continue;
        }

        if (!composeInfo.composeYamlIsValid()) {
          // if the docker-compose.yml file is not valid, remove the folder
          this.logger.warn(
            `Removing sub-compose folder ${composeInfo.path} ` +
              `because its docker-compose.yml file is not valid`
          );
          // use a sudo because it might have some sub folder created with root permissions (like volumes)
          await command.execCommand(`docker compose -f "${composeInfo.getDockerComposePath()}" down`);
          await command.execCommand(`sudo rm -rf "${composeInfo.path}"`);
          continue;
        }
      } catch (e) {
        this.logger.error(`Error while removing error sub-composes '${composeInfo.path}'`, e);
      }
    }
  }
}
