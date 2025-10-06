import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AuthContextService } from '../../core/auth/auth-context.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerCommand } from '../docker-command.class';
import { DockerInspect } from '../docker.class';
import { DockerComposeStatusInfo } from './docker-compose-inspect.class';
import {
  DockerComposeVolumeVariable,
  DockerComposeYaml,
  DockerComposeYamlContext,
} from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { DockerEnvironmentVariables } from './docker-compose.dto';
import { MainDockerCompose } from './main-docker-compose.class';
import { ComposeInfo, ComposeList, SubComposeManager } from './sub-compose-manager';

@Injectable()
export class DockerComposeService {
  // Reference for the main compose containing the app for the lab (glab, codelab, db...)
  public static readonly MAIN_COMPOSE_BRICK = 'gws_core';
  public static readonly MAIN_COMPOSE_UNIQUE = 'main';

  // Reference for the compose containing the reverse proxy and lab manager
  public static readonly SYSTEM_COMPOSE_BRICK = 'gws_core';
  public static readonly SYSTEM_COMPOSE_UNIQUE = 'global';
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
    return new MainDockerCompose(
      composePath,
      DockerComposeService.MAIN_COMPOSE_BRICK,
      DockerComposeService.MAIN_COMPOSE_UNIQUE,
      envPath
    );
  }

  ///////////////////////////////////// Registration /////////////////////////////////////

  /**
   * Register a sub compose object from a ComposeYaml instance.
   * If a compose with the same brick and unique name exists and its content differs,
   * it will be replaced with the new one and the old containers will be removed.
   * @param composeYaml The ComposeYaml instance.
   * @returns The created DockerCompose instance.
   */
  public async registerSubCompose(
    composeYaml: DockerComposeYaml,
    description: string,
    environmentVariables?: DockerEnvironmentVariables
  ): Promise<DockerCompose> {
    const brickName = composeYaml.getBrickName();
    const uniqueName = composeYaml.getUniqueName();

    await this.checkAndFomatComposeYaml(composeYaml, description, environmentVariables);

    // Use SubComposeManager to handle file writing and registration
    const composeFilePath = this.subComposeManager.addSubCompose(composeYaml);

    return new DockerCompose(composeFilePath, brickName, uniqueName);
  }

  /**
   * Get the parent path for the volumes of the sub-composes based on environment
   * and brick/unique name.
   * @returns The path to the volume parent folder
   */
  private getHostVolumeVariable(brickName: string, uniqueName: string): DockerComposeVolumeVariable {
    if (this.configService.isLocal()) {
      // TODO TO improve as this will not work with multiple volumes
      // In local mode we use named volumes
      return {
        hostVolume: `${brickName}_${uniqueName}`,
        isNamed: true,
      };
    }
    let parentPath: string;
    const authContext = AuthContextService.getContext();
    // when the request is made from lab in dev mode, use the dev extensions folder
    // otherwise use the prod extensions folder
    if (authContext?.type === 'lab' && authContext?.env === 'dev') {
      parentPath = this.configService.getDevDataExtensionsFolder();
    } else {
      parentPath = this.configService.getProdDataExtensionsFolder();
    }

    return {
      hostVolume: join(parentPath, brickName, uniqueName),
      isNamed: false,
    };
  }

  public getSubComposeFolderPath(): string {
    return this.configService.getVolumePath(DockerComposeService.SUB_COMPOSE_FOLDER);
  }

  public getDockerCompose(brickName: string, uniqueName: string): DockerCompose | null {
    if (
      brickName === DockerComposeService.MAIN_COMPOSE_BRICK &&
      uniqueName === DockerComposeService.MAIN_COMPOSE_UNIQUE
    ) {
      return this.createMainComposeObject();
    }
    const composeFilePath = this.subComposeManager.getComposeFilePathIfExists(brickName, uniqueName);
    if (!composeFilePath) {
      return null;
    }

    return new DockerCompose(composeFilePath, brickName, uniqueName);
  }

  public getAndCheckDockerCompose(brickName: string, uniqueName: string): DockerCompose {
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      throw new Error(`Docker compose not found for ${brickName}:${uniqueName}`);
    }

    return dockerCompose;
  }

  public async unregisterDockerCompose(
    brickName: string,
    uniqueName: string
  ): Promise<DockerComposeStatusInfo> {
    if (
      brickName === DockerComposeService.MAIN_COMPOSE_BRICK &&
      uniqueName === DockerComposeService.MAIN_COMPOSE_UNIQUE
    ) {
      throw new Error('Cannot unregister the main compose');
    }
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      throw new Error(`Docker compose not found for ${brickName}:${uniqueName}`);
    }

    // Call compose down to stop and remove containers
    await dockerCompose.composeDown();
    // Remove compose files
    dockerCompose.deleteFiles();

    // Remove entry from config using SubComposeManager
    this.subComposeManager.deleteSubCompose(brickName, uniqueName);

    return dockerCompose.getStatus();
  }

  /**
   * Register and start a sub compose.
   * @param composeContent docker compose file content as string
   * @param brickName The brick name.
   * @param uniqueName The unique name.
   * @param description Description of the compose.
   * @param env Optional environment variables to replace in the compose file.
   * @param async If true, the compose up will be done in background and errors will be logged but not thrown.
   * @returns
   */
  public async registerAndStartSubCompose(
    composeYaml: DockerComposeYaml,
    description: string,
    env?: DockerEnvironmentVariables,
    async: boolean = true
  ): Promise<void> {
    const dockerCompose = await this.registerSubCompose(composeYaml, description, env);

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
   * @param brickName The brick name
   * @param uniqueName The unique name
   * @param sourceDir Path to directory containing docker-compose.yml and other files
   * @param description Description of the compose
   * @param environmentVariables Optional environment variables to replace in the compose file
   * @param async If true, the compose up will be done in background and errors will be logged but not thrown.
   * @returns Status information after registration and startup
   */
  public async registerSubComposeFromDirectory(
    brickName: string,
    uniqueName: string,
    sourceDir: string,
    description: string,
    environmentVariables?: DockerEnvironmentVariables,
    async: boolean = true
  ): Promise<void> {
    // Validate docker-compose.yml exists
    const composeFilePath = join(sourceDir, 'docker-compose.yml');
    const composeContent = readFileSync(composeFilePath, 'utf-8');

    // Parse and validate the compose file
    const composeYaml = new DockerComposeYaml(composeContent, brickName, uniqueName);

    await this.checkAndFomatComposeYaml(composeYaml, description, environmentVariables);

    // Copy all files from source directory (except docker-compose.yml)
    // and generate docker-compose.yml from composeYaml
    const composeFileFinalPath = this.subComposeManager.addSubComposeFromDirectory(composeYaml, sourceDir);

    // Create DockerCompose instance and start it
    const dockerCompose = new DockerCompose(composeFileFinalPath, brickName, uniqueName);

    if (async) {
      dockerCompose.composeUp().catch((err) => {
        // Log the error but don't throw as we are in an async call
        console.error(`Error starting the compose ${brickName}:${uniqueName} : ${err}`);
      });
    } else {
      await dockerCompose.composeUp();
    }
  }

  private async checkAndFomatComposeYaml(
    composeYaml: DockerComposeYaml,
    description: string,
    environmentVariables: DockerEnvironmentVariables
  ): Promise<void> {
    const brickName = composeYaml.getBrickName();
    const uniqueName = composeYaml.getUniqueName();

    if (
      (brickName === DockerComposeService.MAIN_COMPOSE_BRICK &&
        uniqueName === DockerComposeService.MAIN_COMPOSE_UNIQUE) ||
      (brickName === DockerComposeService.SYSTEM_COMPOSE_BRICK &&
        uniqueName === DockerComposeService.SYSTEM_COMPOSE_UNIQUE)
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
    composeYaml.setDescription(description);

    // Determine the context based on the authentication
    const authContext = AuthContextService.getContext();
    let dockerContext: DockerComposeYamlContext = 'none';
    if (authContext?.type === 'lab') {
      dockerContext = authContext.env === 'prod' ? 'prod' : 'dev';
    } else if (authContext?.type === 'space' || authContext?.type === 'local') {
      dockerContext = 'all';
    }

    // Parse variables in the compose file based on the context
    composeYaml.replaceNetworkVariable(dockerContext);
    const hostVolume = this.getHostVolumeVariable(brickName, uniqueName);
    composeYaml.replaceVolumeVariable(hostVolume);
    composeYaml.replaceContainerPrefix(dockerContext);
    const existingCompose = this.getDockerCompose(brickName, uniqueName);

    // Replace any additional environment variables
    if (environmentVariables) {
      composeYaml.replaceEnvVariables(environmentVariables);
    }

    // Check if file exists and content differs
    if (existingCompose && !existingCompose.isEqualToComposeYaml(composeYaml)) {
      if (await existingCompose.oneServiceIsRunning()) {
        await this.unregisterDockerCompose(brickName, uniqueName);
      }
    }
  }

  public async getComposeStatus(brickName: string, uniqueName: string): Promise<DockerComposeStatusInfo> {
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      return {
        status: 'DOWN',
        info: 'Docker compose not found',
      };
    }

    return await dockerCompose.getStatus();
  }

  public getComposeContent(brickName: string, uniqueName: string): string {
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      throw new Error(`Docker compose ${brickName}:${uniqueName} not found`);
    }

    return dockerCompose.getComposeFileContent();
  }

  public getAllSubComposes(): ComposeList {
    return this.subComposeManager.getAllSubComposes();
  }

  public getAllComposes(): ComposeList {
    const mainComposeInfo: ComposeInfo = {
      brickName: DockerComposeService.MAIN_COMPOSE_BRICK,
      uniqueName: DockerComposeService.MAIN_COMPOSE_UNIQUE,
      composeFilePath: this.fileService.dockerComposePath,
      description: 'Main compose for the lab services',
      isSubCompose: false,
    };

    const systemComposeInfo: ComposeInfo = {
      brickName: DockerComposeService.SYSTEM_COMPOSE_BRICK,
      uniqueName: DockerComposeService.SYSTEM_COMPOSE_UNIQUE,
      composeFilePath: null,
      description: 'System compose for the reverse proxy and lab manager',
      isSubCompose: false,
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

  private get subComposeManager(): SubComposeManager {
    return new SubComposeManager(this.getSubComposeFolderPath());
  }
}
