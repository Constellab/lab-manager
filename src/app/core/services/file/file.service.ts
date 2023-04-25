import {BadRequestException, Inject, Injectable} from '@nestjs/common';
import {getPrivateFileTemplate, PrivateFile, PrivateFileData} from '../../models/private-file.class';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'fs';

import {dirname, join} from 'path';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from '../../models/core-module-config.class';
import {CoreConfigService} from '../config/core-config.service';

@Injectable()
export class FileService {

  private readonly assets = 'assets';

  private readonly privateFileName = 'private.json';

  private readonly envFileName = 'lab-manager.env';


  constructor(@Inject(CORE_MODULE_PROVIDER) private config: CoreModuleConfig,
    private configService: CoreConfigService) {
  }

  //////////////////////// PRIVATE FILE ///////////////////////////////////

  public privateFileExists(): boolean {
    return this.exists(this.privateFilePath);
  }

  public createPrivateFile(content: PrivateFile): void {
    this.writeJsonFile(this.privateFilePath, content);
  }

  public readPrivateFile(): PrivateFile {
    if (!this.privateFileExists()) {
      throw new BadRequestException('The private file does not exist. You must initialize the lab once.');
    }

    return this.readJsonFile(this.privateFilePath);
  }

  public getPrivateFileTemplate(): PrivateFile {
    return getPrivateFileTemplate();
  }

  public updatePrivateFileData(data: Partial<PrivateFileData>): void{
    const privateFile = this.readPrivateFile();

    const dataTemplate: PrivateFileData = {
      biota_current_db_url_version: null,
      last_init_manager_version: null,
    };
    privateFile.data = {...dataTemplate, ...privateFile.data ?? {}, ...data};
    this.createPrivateFile(privateFile);  
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

  //////////////////////// ENV FILE //////////////////////

  public get envFilePath(): string {
    return this.getVolumePath(this.envFileName);
  }

  public updateEnvFile(env: string): void {
    this.writeFile(this.envFilePath, env);
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

  public writeJsonFile(path: string, content: any): void {
    this.writeFile(path, JSON.stringify(content));
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

  public deleteFileIfExist(path: string): void {
    if(this.exists(path)){
      unlinkSync(path);
    }
  }

  public deleteFolderIfExist(path: string): void {
    if(this.exists(path)){
      rmSync(path, { recursive: true, force: true });
    }
  }


}
