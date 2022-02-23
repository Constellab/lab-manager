import {Inject, Injectable} from '@nestjs/common';
import {PrivateFile} from '../../models/private-file.class';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';

import {dirname, join} from 'path';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from '../../models/core-module-config.class';
import {CoreConfigService} from '../config/core-config.service';

@Injectable()
export class FileService {

  private readonly assets = 'assets';

  private readonly privateTemplateFileName = 'private-template.json';

  private readonly privateFileName = 'private.json';


  constructor(@Inject(CORE_MODULE_PROVIDER) private config: CoreModuleConfig,
    private configService: CoreConfigService) {
  }

  //////////////////////// PRIVATE FILE ///////////////////////////////////

  public privateFileExists(): boolean {
    return this.exists(this.privateFilePath);
  }

  public createPrivateFile(content: PrivateFile): void {
    this.writeFile(this.privateFilePath, JSON.stringify(content));
  }

  public readPrivateFile(): PrivateFile {
    return this.readJsonFile(this.privateFilePath);
  }

  public readPrivateTemplateFile(): PrivateFile {
    return this.readJsonFile(this.privateTemplateFilePath);
  }

  private get privateTemplateFilePath(): string {
    return this.getAssetPath(this.privateTemplateFileName);
  }

  private get privateFilePath(): string {
    return this.getVolumePath(this.privateFileName);
  }

  //////////////////////// DOCKER COMPOSE //////////////////////

  public copyDockerCompose(): void {
    const templatePath = this.getAssetPath(this.dockerComposeFileName);
    this.copyFile(templatePath, this.dockerComposePath);
  }

  public get dockerComposePath(): string {
    return this.getVolumePath(this.dockerComposeFileName);
  }

  public get dockerComposeFileName(): string {
    if (this.configService.isLocal()) {
      return 'docker-compose-dev.yml';
    } else {
      return 'docker-compose.yml';
    }
  }

  //////////////////////// GENERIC ///////////////////////////////////

  public readJsonFile(path: string): any {
    const content: any = this.readFile(path);
    return JSON.parse(content);
  }

  public exists(path: string): boolean {
    return existsSync(path);
  }

  /**
   * read a file with a path relative to dist folder
   */
  private readFile(path: string): Buffer {
    if (!this.exists(path)) {
      throw new Error(`The file '${path}' does not exist`);
    }

    return readFileSync(path);
  }

  public writeFile(path: string, content: any): void {
    // create the directory first
    const dir = dirname(path);
    mkdirSync(dir, {recursive: true});
    writeFileSync(path, content);
  }

  /**
   * Check if a file exists in dist folder
   * @param path
   */
  public getDistPath(...path: string[]): string {
    return join(this.config.distFolder, ...path);
  }

  public getAssetPath(...path: string[]): string {
    return this.getDistPath(this.assets, ...path);
  }

  /**
   * Check if a file exists in dist folder
   * @param path
   */
  public getVolumePath(...path: string[]): string {
    return this.configService.getVolumePath(...path);
  }

  public copyFile(source: string, destination: string): void {
    copyFileSync(source, destination);
  }

  public createDir(path: string, recursive: boolean = false): void {
    mkdirSync(path, {recursive: recursive});
  }

  public createDirIfNotExists(path: string, recursive: boolean = false): void {
    if (this.exists(path)) return;
    this.createDir(path, recursive);
  }
}
