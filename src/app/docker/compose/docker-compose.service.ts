import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerCommand } from '../docker-command.class';
import { DockerInspect } from '../docker.class';
import { DockerComposeStatusInfo } from './docker-compose-inspect.class';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { RegisterComposeConfig } from './docker-compose.dto';
import {
  ComposeInfo,
  ComposeList,
  DockerComposeUniqueId,
  DockerComposeVolumeVariable,
} from './docker-compose.types';
import { MainDockerCompose } from './main-docker-compose.class';
import { SubComposeManager } from './sub-compose-manager';

@Injectable()
export class DockerComposeService {
  // Reference for the main compose containing the app for the lab (glab, codelab, db...)
  public static readonly MAIN_COMPOSE_ID: DockerComposeUniqueId = {
    brickName: 'gws_core',
    uniqueName: 'main',
    env: 'all',
  };

  // Reference for the compose containing the reverse proxy and lab manager
  public static readonly SYSTEM_COMPOSE_ID: DockerComposeUniqueId = {
    brickName: 'gws_core',
    uniqueName: 'global',
    env: 'all',
  };
  public static readonly SYSTEM_REVERSE_PROXY_NAME = 'reverse_proxy';
  public static readonly SYSTEM_LAB_MANAGER_NAME = 'lab_manager';

  public static readonly SUB_COMPOSE_FOLDER = 'sub-composes';

  constructor(
    private fileService: FileService,
    private configService: CoreConfigService
  ) {}

  public createMainComposeObject(): MainDockerCompose {
    const composePath = this.fileService.dockerComposePath;
    const envPath = this.fileService.envFilePath;
    const composeYaml = DockerComposeYaml.fromTemplateFile(composePath, DockerComposeService.MAIN_COMPOSE_ID);
    return new MainDockerCompose(composePath, composeYaml, envPath);
  }

  ///////////////////////////////////// Registration /////////////////////////////////////

  /**
   * Register a sub compose object from a ComposeYaml instance.
   * If a compose with the same brick and unique name exists and its content differs,
   * it will be replaced with the new one and the old containers will be removed.
   * @param composeYaml The ComposeYaml instance.
   * @param config The configuration for the compose registration.
   * @returns The created DockerCompose instance.
   */
  public async registerSubCompose(
    composeYaml: DockerComposeYaml,
    config: RegisterComposeConfig
  ): Promise<DockerCompose> {
    await this.checkAndFomatSubComposeYaml(composeYaml, config);

    // Use SubComposeManager to handle file writing and registration
    const composeFilePath = this.subComposeManager.addSubCompose(composeYaml);

    return new DockerCompose(composeFilePath, composeYaml);
  }

  /**
   * Get the parent path for the volumes of the sub-composes based on environment
   * and brick/unique name.
   * @returns The path to the volume parent folder
   */
  private getHostVolumeVariable(composeId: DockerComposeUniqueId): DockerComposeVolumeVariable {
    if (this.configService.isLocal()) {
      // TODO TO improve as this will not work with multiple volumes
      // In local mode we use named volumes
      return {
        hostVolume: `${composeId.brickName}_${composeId.uniqueName}`,
        isNamed: true,
      };
    }
    let parentPath: string;
    // when the request is made from lab in dev mode, use the dev extensions folder
    // otherwise use the prod extensions folder
    if (composeId.env === 'dev') {
      parentPath = this.configService.getDevDataExtensionsFolder();
    } else {
      parentPath = this.configService.getProdDataExtensionsFolder();
    }

    return {
      hostVolume: join(parentPath, composeId.brickName, composeId.uniqueName),
      isNamed: false,
    };
  }

  public getSubComposeFolderPath(): string {
    return join(this.configService.getConfFolder(), DockerComposeService.SUB_COMPOSE_FOLDER);
  }

  public getDockerCompose(composeId: DockerComposeUniqueId): DockerCompose | null {
    if (
      composeId.brickName === DockerComposeService.MAIN_COMPOSE_ID.brickName &&
      composeId.uniqueName === DockerComposeService.MAIN_COMPOSE_ID.uniqueName
    ) {
      return this.createMainComposeObject();
    }

    return this.subComposeManager.getSubCompose(composeId);
  }

  public getAndCheckDockerCompose(composeId: DockerComposeUniqueId): DockerCompose {
    const dockerCompose = this.getDockerCompose(composeId);

    if (!dockerCompose) {
      throw new Error(
        `Docker compose not found for ${composeId.brickName}:${composeId.uniqueName}:${composeId.env}`
      );
    }

    return dockerCompose;
  }

  public async unregisterDockerCompose(composeId: DockerComposeUniqueId): Promise<DockerComposeStatusInfo> {
    const { brickName, uniqueName } = composeId;
    if (
      brickName === DockerComposeService.MAIN_COMPOSE_ID.brickName &&
      uniqueName === DockerComposeService.MAIN_COMPOSE_ID.uniqueName
    ) {
      throw new Error('Cannot unregister the main compose');
    }
    const dockerCompose = this.getDockerCompose(composeId);

    if (!dockerCompose) {
      throw new Error(`Docker compose not found for ${brickName}:${uniqueName}:${composeId.env}`);
    }

    // Call compose down to stop and remove containers
    await dockerCompose.composeDown();
    // Remove compose files
    dockerCompose.deleteFiles();

    // Remove entry from config using SubComposeManager
    this.subComposeManager.deleteSubCompose(composeId);

    return dockerCompose.getStatus();
  }

  /**
   * Register and start a sub compose.
   * @param composeYaml The ComposeYaml instance.
   * @param async If true, the compose up will be done in background and errors will be logged but not thrown.
   * @returns
   */
  public async registerAndStartSubCompose(
    composeYaml: DockerComposeYaml,
    config: RegisterComposeConfig,
    async: boolean = true
  ): Promise<void> {
    const dockerCompose = await this.registerSubCompose(composeYaml, config);

    if (async) {
      dockerCompose.composeUp().catch((err) => {
        // Log the error but don't throw as we are in an async call
        console.error(
          `Error starting the compose ${composeYaml.getBrickName()}:${composeYaml.getUniqueName()} : ${err}`
        );
      });
    } else {
      await dockerCompose.composeUp();
    }
  }

  /**
   * Register and start a sub-compose from a directory containing docker-compose.yml and other files
   * @param composeId The unique identifier for the compose
   * @param sourceDir Path to directory containing docker-compose.yml and other files
   * @param config The configuration for the compose registration
   * @param async If true, the compose up will be done in background and errors will be logged but not thrown.
   * @returns Status information after registration and startup
   */
  public async registerSubComposeFromDirectory(
    composeId: DockerComposeUniqueId,
    sourceDir: string,
    config: RegisterComposeConfig,
    async: boolean = true
  ): Promise<void> {
    // Validate docker-compose.yml exists
    const composeFilePath = join(sourceDir, 'docker-compose.yml');
    const composeContent = readFileSync(composeFilePath, 'utf-8');

    // Parse and validate the compose file
    const composeYaml = new DockerComposeYaml(composeContent, composeId);

    await this.checkAndFomatSubComposeYaml(composeYaml, config);

    // Copy all files from source directory (except docker-compose.yml)
    // and generate docker-compose.yml from composeYaml
    const composeFileFinalPath = this.subComposeManager.addSubComposeFromDirectory(composeYaml, sourceDir);

    // Create DockerCompose instance and start it
    const dockerCompose = new DockerCompose(composeFileFinalPath, composeYaml);

    if (async) {
      dockerCompose.composeUp().catch((err) => {
        // Log the error but don't throw as we are in an async call
        console.error(
          `Error starting the compose ${composeId.brickName}:${composeId.uniqueName}:${composeId.env}` +
            ` : ${err}`
        );
      });
    } else {
      await dockerCompose.composeUp();
    }
  }

  private async checkAndFomatSubComposeYaml(
    composeYaml: DockerComposeYaml,
    config: RegisterComposeConfig
  ): Promise<void> {
    const brickName = composeYaml.getBrickName();
    const uniqueName = composeYaml.getUniqueName();
    const env = composeYaml.getEnv();

    if (
      (brickName === DockerComposeService.MAIN_COMPOSE_ID.brickName &&
        uniqueName === DockerComposeService.MAIN_COMPOSE_ID.uniqueName) ||
      (brickName === DockerComposeService.SYSTEM_COMPOSE_ID.brickName &&
        uniqueName === DockerComposeService.SYSTEM_COMPOSE_ID.uniqueName)
    ) {
      throw new Error('Cannot register the main compose');
    }

    // Check that the brick name and unique name are valid
    // they should only contain alphanumeric characters, dashes or underscores
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(brickName)) {
      throw new Error(
        'Invalid brick name. Only alphanumeric characters, dashes and underscores are allowed.'
      );
    }
    if (!nameRegex.test(uniqueName)) {
      throw new Error(
        'Invalid unique name. Only alphanumeric characters, dashes and underscores are allowed.'
      );
    }

    // Set description
    composeYaml.setDescription(config.description);

    // Set auto start
    composeYaml.setAutoStart(config.autoStart ?? true);

    // Parse variables in the compose file based on the context
    const hostVolume = this.getHostVolumeVariable(composeYaml.getComposeId());
    composeYaml.parseVariables(
      hostVolume,
      {
        labDomain: this.configService.getVirtualHost(),
      },
      config.envVariables
    );

    // Check if file exists and content differs
    const existingCompose = this.getDockerCompose({ brickName, uniqueName, env });
    if (existingCompose && !existingCompose.isEqualToComposeYaml(composeYaml)) {
      if (await existingCompose.oneServiceIsRunning()) {
        await this.unregisterDockerCompose({ brickName, uniqueName, env });
      }
    }
  }

  public async getComposeStatus(composeId: DockerComposeUniqueId): Promise<DockerComposeStatusInfo> {
    const dockerCompose = this.getDockerCompose(composeId);

    if (!dockerCompose) {
      return {
        status: 'DOWN',
        info: 'Docker compose not found',
      };
    }

    return await dockerCompose.getStatus();
  }

  public getComposeContent(composeId: DockerComposeUniqueId): string {
    const dockerCompose = this.getDockerCompose(composeId);

    if (!dockerCompose) {
      throw new Error(
        `Docker compose ${composeId.brickName}:${composeId.uniqueName}:${composeId.env} not found`
      );
    }

    return dockerCompose.getComposeFileContent();
  }

  public getAllSubComposes(): ComposeList {
    return this.subComposeManager.getAllSubComposes();
  }

  public getAllComposes(): ComposeList {
    const mainComposeInfo: ComposeInfo = {
      brickName: DockerComposeService.MAIN_COMPOSE_ID.brickName,
      uniqueName: DockerComposeService.MAIN_COMPOSE_ID.uniqueName,
      composeFilePath: this.fileService.dockerComposePath,
      description: 'Main compose for the lab services',
      isSubCompose: false,
      env: DockerComposeService.MAIN_COMPOSE_ID.env,
      autoStart: true,
    };

    const systemComposeInfo: ComposeInfo = {
      brickName: DockerComposeService.SYSTEM_COMPOSE_ID.brickName,
      uniqueName: DockerComposeService.SYSTEM_COMPOSE_ID.uniqueName,
      composeFilePath: null,
      description: 'System compose for the reverse proxy and lab manager',
      isSubCompose: false,
      env: DockerComposeService.SYSTEM_COMPOSE_ID.env,
      autoStart: true,
    };

    const subComposes = this.subComposeManager.getAllSubComposes();

    return {
      composes: [mainComposeInfo, systemComposeInfo, ...subComposes.composes],
    };
  }

  /**
   * Special case to inspect the global compose which contains the reverse proxy and lab manager
   * We don't have access to the compose file so we manually inspect the containers
   */
  public async inspectSystemCompose(): Promise<DockerInspect[]> {
    const dockerCommand = new DockerCommand();
    const reversePrxyInspect = await dockerCommand.dockerInspect(
      DockerComposeService.SYSTEM_REVERSE_PROXY_NAME
    );
    const labManagerInspect = await dockerCommand.dockerInspect(DockerComposeService.SYSTEM_LAB_MANAGER_NAME);

    return [reversePrxyInspect, labManagerInspect];
  }

  public get subComposeManager(): SubComposeManager {
    return new SubComposeManager(this.getSubComposeFolderPath());
  }
}
