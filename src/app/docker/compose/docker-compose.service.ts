import { Injectable } from '@nestjs/common';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerComposeStatusInfo } from './docker-compose-inspect.class';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { MainDockerCompose } from './main-docker-compose.class';
import { SubComposeList, SubComposeManager } from './sub-compose-manager';

@Injectable()
export class DockerComposeService {
  MAIN_COMPOSE_BRICK = 'gws_core';
  MAIN_COMPOSE_UNIQUE = 'main';

  SUB_COMPOSE_FOLDER = 'sub-composes';

  constructor(
    private fileService: FileService,
    private configService: CoreConfigService
  ) {}

  public createMainComposeObject(): MainDockerCompose {
    const composePath = this.fileService.dockerComposePath;
    const envPath = this.fileService.envFilePath;
    return new MainDockerCompose(composePath, this.MAIN_COMPOSE_BRICK, this.MAIN_COMPOSE_UNIQUE, envPath);
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

    const existingCompose = this.getDockerCompose(brickName, uniqueName);

    // Check if file exists and content differs
    if (existingCompose && !existingCompose.isEqualToComposeYaml(composeYaml)) {
      if (await existingCompose.oneServiceIsRunning()) {
        await this.deleteDockerCompose(brickName, uniqueName);
      }
    }

    // Use SubComposeManager to handle file writing and registration
    const composeFilePath = this.subComposeManager.addSubCompose(composeYaml);

    return new DockerCompose(composeFilePath, brickName, uniqueName);
  }

  public getSubComposeFolderPath(): string {
    return this.configService.getVolumePath(this.SUB_COMPOSE_FOLDER);
  }

  public getDockerCompose(brickName: string, uniqueName: string): DockerCompose | null {
    const composeInfo = this.subComposeManager.getSubCompose(brickName, uniqueName);

    if (!composeInfo) {
      return null;
    }

    return new DockerCompose(composeInfo.composeFilePath, brickName, uniqueName);
  }

  public async deleteDockerCompose(brickName: string, uniqueName: string): Promise<boolean> {
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
  public async startSubCompose(
    composeContent: string,
    brickName: string,
    uniqueName: string
  ): Promise<string> {
    const composeYaml = new DockerComposeYaml(composeContent, brickName, uniqueName);
    const dockerCompose = await this.registerSubCompose(composeYaml);
    return await dockerCompose.composeUp();
  }

  public async getSubComposeStatus(brickName: string, uniqueName: string): Promise<DockerComposeStatusInfo> {
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      return {
        status: 'DOWN',
        info: 'Docker compose not found',
      };
    }

    return await dockerCompose.getStatus();
  }

  public getAllSubComposes(): SubComposeList {
    return this.subComposeManager.getAllSubComposes();
  }

  private get subComposeManager(): SubComposeManager {
    return new SubComposeManager(this.getSubComposeFolderPath());
  }
}
