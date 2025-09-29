import { Injectable } from '@nestjs/common';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerCommand } from '../docker-command.class';
import { DockerInspect } from '../docker.class';
import { DockerComposeStatusInfo } from './docker-compose-inspect.class';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { StartComposeRequestOptionsDTO } from './docker-compose.dto';
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
  public static readonly SYSTEM_REVERSE_PROXY_NAME = 'reverse-proxy';
  public static readonly SYSTEM_LAB_MANAGER_NAME = 'lab-manager';

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
  public async registerSubCompose(composeYaml: DockerComposeYaml): Promise<DockerCompose> {
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
    const existingCompose = this.getDockerCompose(brickName, uniqueName);

    // Check if file exists and content differs
    if (existingCompose && !existingCompose.isEqualToComposeYaml(composeYaml)) {
      if (await existingCompose.oneServiceIsRunning()) {
        await this.unregisterDockerCompose(brickName, uniqueName);
      }
    }

    // Use SubComposeManager to handle file writing and registration
    const composeFilePath = this.subComposeManager.addSubCompose(composeYaml);

    return new DockerCompose(composeFilePath, brickName, uniqueName);
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

  public async unregisterDockerCompose(brickName: string, uniqueName: string): Promise<boolean> {
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
    return this.subComposeManager.deleteSubCompose(brickName, uniqueName);
  }

  /**
   * Register and start a sub compose.
   * @param composeContent docker compose file content as string
   * @param brickName The brick name.
   * @param uniqueName The unique name.
   * @returns
   */
  public async registerAndStartSubCompose(
    composeContent: string,
    options: StartComposeRequestOptionsDTO,
    brickName: string,
    uniqueName: string
  ): Promise<string> {
    const composeYaml = new DockerComposeYaml(composeContent, brickName, uniqueName);
    if (options?.description) {
      composeYaml.setDescription(options.description);
    }
    const dockerCompose = await this.registerSubCompose(composeYaml);
    return await dockerCompose.composeUp();
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
