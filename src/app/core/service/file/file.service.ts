import {Inject, Injectable} from '@nestjs/common';
import {PrivateFile} from '../../model/private-file.class';
import {existsSync, readFileSync, writeFileSync} from 'fs';

import {join} from 'path';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from '../../model/core-module-config.class';
import {ConfigFile} from '../../model/config-file.class';

@Injectable()
export class FileService {

  private readonly assets = 'assets';

  private readonly privateTemplateFileName = 'private-template.json';
  private readonly configTemplateFileName = 'config-template.json';

  private readonly privateFileName = 'private.json';
  private readonly configFileName = 'config.json';

  constructor(@Inject(CORE_MODULE_PROVIDER) private config: CoreModuleConfig) {
  }

  //////////////////////// PRIVATE FILE ///////////////////////////////////

  public privateFileExists(): boolean {
    return this.fileExists(this.privateFilePath);
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
    return this.getDistPath(this.assets, this.privateTemplateFileName);
  }

  private get privateFilePath(): string {
    return this.getDistPath(this.assets, this.privateFileName);
  }

  //////////////////////// CONFIG FILE ///////////////////////////////////

  public configFileExists(): boolean {
    return this.fileExists(this.configFilePath);
  }

  public createConfigFile(content: ConfigFile): void {
    this.writeFile(this.configFilePath, JSON.stringify(content));
  }

  public readConfigFile(): ConfigFile {
    return this.readJsonFile(this.configFilePath);
  }

  public readConfigTemplateFile(): ConfigFile {
    return this.readJsonFile(this.configTemplateFilePath);
  }

  private get configTemplateFilePath(): string {
    return this.getDistPath(this.assets, this.configTemplateFileName);
  }

  private get configFilePath(): string {
    return this.getDistPath(this.assets, this.configFileName);
  }

  //////////////////////// GENERIC ///////////////////////////////////

  private readJsonFile(path: string): any {
    const content: any = this.readFile(path);
    return JSON.parse(content);
  }

  private fileExists(path: string): boolean {
    return existsSync(path);
  }

  /**
   * read a file with a path relative to dist folder
   */
  private readFile(path: string): Buffer {
    if (!this.fileExists(path)) {
      throw new Error(`The file '${path}' does not exist`);
    }

    return readFileSync(path);
  }

  private writeFile(path: string, content: any): void {
    writeFileSync(path, content);
  }

  /**
   * Check if a file exists in dist folder
   * @param path
   */
  private getDistPath(...path: string[]): string {
    return join(this.config.distFolder, ...path);
  }
}
