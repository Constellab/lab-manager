import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { MainDockerCompose } from './main-docker-compose.class';

export interface SubComposeConfigCompose {
  brickName: string;
  uniqueName: string;
  composeFilePath: string;
  envFilePath?: string;
}

export interface SubComposeConfig {
  composes: SubComposeConfigCompose[];
}

@Injectable()
export class DockerComposeService {
  MAIN_COMPOSE_BRICK = 'gws_core';
  MAIN_COMPOSE_UNIQUE = 'main';

  SUB_COMPOSE_FOLDER = 'sub-composes';
  SUB_COMPOSE_CONFIG_FILE = 'sub-compose.json';

  constructor(
    private fileService: FileService,
    private configService: CoreConfigService
  ) {}

  public createMainComposeObject(): MainDockerCompose {
    const composePath = this.fileService.dockerComposePath;
    const envPath = this.fileService.envFilePath;
    return new MainDockerCompose(composePath, this.MAIN_COMPOSE_BRICK, this.MAIN_COMPOSE_UNIQUE, envPath);
  }

  ///////////////////////////////////// SUB COMPOSES /////////////////////////////////////

  /**
   * Register a sub compose object from a ComposeYaml instance.
   * If a compose with the same brick and unique name exists and its content differs,
   * it will be replaced with the new one and the old containers will be removed.
   * @param composeYaml The ComposeYaml instance.
   * @param brickName The brick name.
   * @param uniqueName The unique name.
   * @param envFilePath The environment file path (optional).
   * @returns The created DockerCompose instance.
   */
  public async registerSubCompose(
    composeYaml: DockerComposeYaml,
    brickName: string,
    uniqueName: string,
    envFilePath?: string
  ): Promise<DockerCompose> {
    const existingCompose = this.getDockerCompose(brickName, uniqueName);

    // Check if file exists and content differs
    if (existingCompose && !existingCompose.isEqualToComposeYaml(composeYaml)) {
      await this.deleteDockerCompose(brickName, uniqueName);
    }

    const subComposeFolder = this.getSubComposeFolderPath();

    // Create subfolder with brick_name-unique_name pattern
    const subFolderName = `${brickName}-${uniqueName}`;
    const subFolderPath = join(subComposeFolder, subFolderName);

    // Ensure sub compose folder exists
    this.fileService.createDirIfNotExists(subComposeFolder, true);
    // Ensure the specific subfolder exists
    this.fileService.createDirIfNotExists(subFolderPath, true);

    // Write the compose file
    // Create compose file name and path
    const composeFileName = `docker-compose-${brickName}-${uniqueName}.yml`;
    const composeFilePath = join(subFolderPath, composeFileName);
    this.fileService.writeFile(composeFilePath, composeYaml.toString());

    // Update config
    this.updateSubComposeConfigFile(brickName, uniqueName, composeFilePath, envFilePath);

    return new DockerCompose(composeFilePath, brickName, uniqueName, envFilePath);
  }

  public getSubComposeFolderPath(): string {
    return this.configService.getVolumePath(this.SUB_COMPOSE_FOLDER);
  }

  public getDockerCompose(brickName: string, uniqueName: string): DockerCompose | null {
    const configFilePath = this.getSubComposeConfigFilePath();

    if (!this.fileService.exists(configFilePath)) {
      return null;
    }

    const config: SubComposeConfig = this.fileService.readJsonFile(configFilePath);
    const composeEntry = config.composes.find(
      (compose) => compose.brickName === brickName && compose.uniqueName === uniqueName
    );

    if (!composeEntry || !this.fileService.exists(composeEntry.composeFilePath)) {
      return null;
    }

    return new DockerCompose(composeEntry.composeFilePath, brickName, uniqueName, composeEntry.envFilePath);
  }

  public async deleteDockerCompose(brickName: string, uniqueName: string): Promise<boolean> {
    const dockerCompose = this.getDockerCompose(brickName, uniqueName);

    if (!dockerCompose) {
      return false;
    }

    // Call compose down to stop and remove containers
    await dockerCompose.composeDown();

    // Get config file path and read current config
    const configFilePath = this.getSubComposeConfigFilePath();
    if (!this.fileService.exists(configFilePath)) {
      return false;
    }

    const config: SubComposeConfig = this.fileService.readJsonFile(configFilePath);
    const composeEntry = config.composes.find(
      (compose) => compose.brickName === brickName && compose.uniqueName === uniqueName
    );

    if (!composeEntry) {
      return false;
    }

    // Delete the compose file
    this.fileService.deleteFileIfExist(composeEntry.composeFilePath);

    // Remove entry from config
    config.composes = config.composes.filter(
      (compose) => !(compose.brickName === brickName && compose.uniqueName === uniqueName)
    );

    // Write updated config
    this.fileService.writeJsonFile(configFilePath, config);

    return true;
  }

  ////////////////////////////// CONFIG FILE ///////////////////////////////

  public getSubComposeConfigFilePath(): string {
    return join(this.getSubComposeFolderPath(), this.SUB_COMPOSE_CONFIG_FILE);
  }

  private updateSubComposeConfigFile(
    brickName: string,
    uniqueName: string,
    composeFilePath: string,
    envFilePath?: string
  ): void {
    const configFilePath = this.getSubComposeConfigFilePath();

    // Read or create config
    let config: SubComposeConfig;
    if (this.fileService.exists(configFilePath)) {
      config = this.fileService.readJsonFile(configFilePath);
    } else {
      config = { composes: [] };
    }

    // Find existing entry or create new one
    const existingIndex = config.composes.findIndex(
      (compose) => compose.brickName === brickName && compose.uniqueName === uniqueName
    );

    const composeEntry: SubComposeConfigCompose = {
      brickName,
      uniqueName,
      composeFilePath,
      envFilePath,
    };

    if (existingIndex >= 0) {
      // Update existing entry
      config.composes[existingIndex] = composeEntry;
    } else {
      // Add new entry
      config.composes.push(composeEntry);
    }

    // Write updated config
    this.fileService.writeJsonFile(configFilePath, config);
  }
}
