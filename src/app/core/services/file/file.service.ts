import { BadRequestException, Injectable } from '@nestjs/common';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { readdir, stat } from 'fs/promises';
import { getPrivateFileTemplate, PrivateFile, PrivateFileData } from '../../models/private-file.class';

import { dirname, join } from 'path';
import { StartLog } from 'src/app/docker/docker.class';
import { CoreConfigService } from '../config/core-config.service';

@Injectable()
export class FileService {

  private readonly privateFileName = 'private.json';

  private readonly envFileName = 'lab-manager.env';

  constructor(private configService: CoreConfigService) {}

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

  public updatePrivateFileData(data: Partial<PrivateFileData>): void {
    const privateFile = this.readPrivateFile();

    const dataTemplate: PrivateFileData = {
      biota_current_db_url_version: null,
      last_init_manager_version: null,
    };
    privateFile.data = { ...dataTemplate, ...(privateFile.data ?? {}), ...data };
    this.createPrivateFile(privateFile);
  }

  private get privateFilePath(): string {
    return this.getConfPath(this.privateFileName);
  }

  //////////////////////// LOG START FILE //////////////////////

  public readLogStartFileIfExists(mode: 'dev' | 'prod'): StartLog | null {
    const logFilePath =
      mode === 'prod' ? this.configService.getProdStartLogFile() : this.configService.getDevStartLogFile();

    if (!this.exists(logFilePath)) {
      return null;
    }

    const content = this.readFile(logFilePath);
    return JSON.parse(content);
  }

  //////////////////////// DOCKER COMPOSE //////////////////////

  public copyDockerCompose(): void {
    const templatePath = this.configService.getAssetPath(this.dockerComposeFileName);
    this.copyFile(templatePath, this.dockerComposePath);
  }

  public readDockerComposeTemplate(): string {
    const templatePath = this.configService.getAssetPath(this.dockerComposeFileName);
    return this.readFile(templatePath);
  }

  public writeDockerCompose(content: string): void {
    this.writeFile(this.dockerComposePath, content);
  }

  public get dockerComposePath(): string {
    return this.getConfPath(this.dockerComposeFileName);
  }

  public dockerComposeFileExists(): boolean {
    return this.exists(this.dockerComposePath);
  }

  public get dockerComposeFileName(): string {
    if (this.configService.isLocal()) {
      return 'docker-compose-local.yml';
    } else {
      return 'docker-compose.yml';
    }
  }

  //////////////////////// ENV FILE //////////////////////

  public get envFilePath(): string {
    return this.getConfPath(this.envFileName);
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
  private readFile(path: string): string {
    if (!this.exists(path)) {
      throw new Error(`The file '${path}' does not exist`);
    }

    return readFileSync(path, { encoding: 'utf-8' });
  }

  public writeJsonFile(path: string, content: any): void {
    this.writeFile(path, JSON.stringify(content));
  }

  public writeFile(path: string, content: any): void {
    // create the directory first
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, content);
  }

  /**
   * Check if a file exists in dist folder
   * @param path
   */
  public getConfPath(...path: string[]): string {
    return join(this.configService.getConfFolder(), ...path);
  }

  public copyFile(source: string, destination: string): void {
    copyFileSync(source, destination);
  }

  public createDir(path: string, recursive: boolean = false): void {
    mkdirSync(path, { recursive: recursive });
  }

  public createDirIfNotExists(path: string, recursive: boolean = false): void {
    if (this.exists(path)) return;
    this.createDir(path, recursive);
  }

  public deleteFileIfExist(path: string): void {
    if (this.exists(path)) {
      unlinkSync(path);
    }
  }

  public deleteFolderIfExist(path: string): void {
    if (this.exists(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  }

  public getFileSize(path: string): number {
    return readFileSync(path).byteLength;
  }

  public folderIsEmpty(path: string): boolean {
    const files = readdirSync(path);
    return files.length === 0;
  }

  // eslint-disable-next-line max-len
  // code from https://stackoverflow.com/questions/30448002/how-to-get-directory-size-in-node-js-without-recursively-going-through-directory
  public async getFolderSize(dirPath: string): Promise<number> {
    // const files = await readdir(path);
    // const stats = files.map(file => stat(join(path, file)));

    // return (await Promise.all(stats)).reduce((accumulator, { size }) => accumulator + size, 0);

    const files = await readdir(dirPath, { withFileTypes: true });

    const paths = files.map(async (file) => {
      const path = join(dirPath, file.name);

      if (file.isDirectory()) return await this.getFolderSize(path);

      if (file.isFile()) {
        const { size } = await stat(path);

        return size;
      }

      return 0;
    });

    return (await Promise.all(paths)).flat(Infinity).reduce((i, size) => i + size, 0);
  }
}
