import {BadRequestException, Injectable} from '@nestjs/common';
import {Brick} from '../../core/models/brick.class';
import {
  ConfigBrickPackage,
  ConfigFile,
  ConfigFileEnvGit,
  ConfigFileEnvPip,
  LabConfigDTO,
  SaveBrickDTO,
  UpdateConfigDTO
} from '../../core/models/config-file.class';
import {FileService} from '../../core/services/file/file.service';

@Injectable()
export class ConfigFileService {

  private readonly configFileName = 'config.json';


  constructor(private fileService: FileService) {
  }


  /**
   * Update the config and store result in config file
   * @param updateConfig
   */
  public updateConfig(updateConfig: UpdateConfigDTO): void {
    let config: ConfigFile;

    if (this.configFileExists()) {
      config = this.readConfigFile();
    } else {
      config = this.getDefaultConfig();
    }

    // set the front version
    config.frontVersion = updateConfig.frontVersion;

    const pipEnv: ConfigFileEnvPip[] = [];
    const gitEnv: ConfigFileEnvGit[] = [];

    for (const brick of updateConfig.bricks) {
      if (brick.repoType !== 'GIT' && brick.repoType !== 'PIP') {
        throw new BadRequestException(`The report type '${brick.repoType}' of brick '${brick.name}' is not supported. Expected PIP or GIT`);
      }
      const brickPackage: ConfigBrickPackage = this.convertSaveBrickDTOToBrick(brick);

      // add the package to the right place
      let packageEnvs: (ConfigFileEnvPip | ConfigFileEnvGit)[];

      if (brick.repoType === 'GIT') {
        packageEnvs = gitEnv;
      } else {
        packageEnvs = pipEnv;
      }

      // create the package env with the right source if it doesn't exist
      if (packageEnvs.findIndex(git => git.source === brick.repo) < 0) {
        packageEnvs.push({
          source: brick.repo,
          packages: []
        });
      }

      // retrieve the package en with repo
      const packageEnv = packageEnvs.find(git => git.source === brick.repo);
      // add the brick into the repo
      packageEnv.packages.push(brickPackage as any);
    }

    // override git and pip envs
    config.environment.git = gitEnv;
    config.environment.pip = pipEnv;

    this.writeConfigFile(config);
  }

  private convertSaveBrickDTOToBrick(brickDTO: SaveBrickDTO): ConfigBrickPackage {
    if (brickDTO.repoType === 'PIP') {
      return {
        name: brickDTO.name,
        is_brick: true,
        is_hidden: brickDTO.isHidden,
        version: brickDTO.version,
      };
    } else {
      return {
        name: brickDTO.name,
        is_brick: true,
        is_hidden: brickDTO.isHidden,
        commit: brickDTO.commit,
        branch: brickDTO.branch,
        version: brickDTO.version
      };
    }
  }

  public getLabConfig(): LabConfigDTO {
    return {
      bricks: this.getBricks()
    };
  }

  private getDefaultConfig(): ConfigFile {
    return {
      name: 'app',
      title: 'Gencovery Lab',
      description: 'Gencovery Digital Lab as a Service',
      app_dir: '/app',
      uri: '91620768-2cdd-11eb-adc1-0242ac120002',
      frontVersion: null,
      variables: {},
      environment: {
        pip: [],
        git: [],
        variables: {}
      }
    };
  }

  ///////////////////////////// FILE  ///////////////////////////////

  public configFileExists(): boolean {
    return this.fileService.exists(this.configFilePath);
  }

  public writeConfigFile(content: ConfigFile): void {
    this.fileService.writeFile(this.configFilePath, JSON.stringify(content));
  }

  public readConfigFile(): ConfigFile {
    if (!this.configFileExists()) {
      throw new BadRequestException('the config file does not exist. You must configure the bricks before calling init');
    }
    return this.fileService.readJsonFile(this.configFilePath);
  }


  private get configFilePath(): string {
    return this.fileService.getVolumePath(this.configFileName);
  }


  ///////////////////////////// BRICK ///////////////////////////////

  public getBricks(): Brick[] {
    const config: ConfigFile = this.readConfigFile();

    const bricks: Brick[] = [];

    for (const pipEnv of config.environment.pip) {
      for (const brick of pipEnv.packages) {
        if (brick.is_brick) {
          bricks.push({
            name: brick.name,
            repoType: 'PIP',
            version: brick.version,
            repo: pipEnv.source,
            isHidden: brick.is_hidden
          });
        }
      }
    }

    // add git bricks
    for (const gitEnv of config.environment.git) {
      for (const brick of gitEnv.packages) {
        if (brick.is_brick) {
          bricks.push({
            name: brick.name,
            repoType: 'GIT',
            version: brick.version,
            branch: brick.branch,
            commit: brick.commit,
            repo: gitEnv.source,
            isHidden: brick.is_hidden
          });
        }
      }
    }

    return bricks;
  }

  public getBrick(brickName: string): Brick | null {
    return this.getBricks().find(brick => brick.name === brickName);
  }

  public hasBrick(brickName: string): boolean {
    return this.getBrick(brickName) != null;
  }
}
