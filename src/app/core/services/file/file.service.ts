import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { Command, ExecCommandMode } from '../../utils/command';
import { CoreConfigService } from '../config/core-config.service';

@Injectable()
export class FileService {
  private readonly privateFileName = 'private.json';

  private readonly envFileName = 'lab-manager.env';

  private readonly logger = new Logger(FileService.name);

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
      lastInitManagerVersion: null,
      lastInitConfigHash: null,
    };
    privateFile.data = { ...dataTemplate, ...(privateFile.data ?? {}), ...data };
    this.createPrivateFile(privateFile);
  }

  private get privateFilePath(): string {
    return this.getConfPath(this.privateFileName);
  }

  //////////////////////// LOG START FILE //////////////////////

  public readLogStartFileIfExists(mode: 'dev' | 'prod'): StartLog | null {
    const logFilePath = this.configService.getStartLogFile(mode);

    if (!this.exists(logFilePath)) {
      return null;
    }

    try {
      const content = this.readFile(logFilePath);
      return JSON.parse(content);
    } catch (e) {
      this.logger.error(`Error reading/parsing start log file for mode ${mode}`, e);
      return null;
    }
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

  //////////////////////// CUSTOM ENV FILE //////////////////////

  // Custom, ops-set vars (e.g. GWS_MCP_SERVER_ENABLED), injected into the lab
  // container via `env_file:`. Distinct from lab-manager.env, which holds fixed
  // system config consumed by compose `--env-file` interpolation.
  private readonly customVarsFileName = 'lab-manager-custom.env';

  public get customVarsFilePath(): string {
    return this.getConfPath(this.customVarsFileName);
  }

  public updateCustomVarsFile(env: string): void {
    this.writeFile(this.customVarsFilePath, env);
  }

  /**
   * Ensure the custom-vars file exists (create it empty if missing).
   * The glab service references it via `env_file:`, and docker compose errors on a
   * missing env file. `setAllEnvVariables` writes it on every config update, but a
   * bare restart (without a config update) could run compose before it ever existed
   * -- e.g. right after upgrading to the compose file that adds the `env_file:` entry.
   */
  public ensureCustomVarsFileExists(): void {
    if (!this.exists(this.customVarsFilePath)) {
      this.writeFile(this.customVarsFilePath, '');
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

  //////////////////////// OWNERSHIP MANIFEST //////////////////////

  /**
   * Generate an ownership manifest file for a directory.
   * The manifest contains file paths with their UID, GID, and permissions.
   *
   * @param dirPath - Directory to scan for ownership information
   * @param manifestPath - Path where to save the manifest file
   * @returns Promise that resolves when manifest is created
   */
  public async generateOwnershipManifest(dirPath: string, manifestPath: string): Promise<void> {
    // Ensure the manifest directory exists
    mkdirSync(dirname(manifestPath), { recursive: true });

    // Use sudo find to get ownership info for all files
    // Format: path|uid|gid|mode
    const command = `sudo find "${dirPath}" -printf '%p|%U|%G|%m\\n' > "${manifestPath}"`;

    await new Command().execCommand(command, ExecCommandMode.STDERR_AS_WARNING);

    this.logger.log(`Ownership manifest generated at ${manifestPath}`);
  }

  /**
   * Apply ownership from a manifest file to restore file ownership.
   * This is used during backup restoration to preserve original file ownership.
   *
   * @param manifestPath - Path to the ownership manifest file
   * @returns Promise that resolves when ownership is applied
   */
  public async applyOwnershipFromManifest(manifestPath: string): Promise<void> {
    if (!this.exists(manifestPath)) {
      throw new Error(`Ownership manifest not found at ${manifestPath}`);
    }

    this.logger.log(`Applying ownership from manifest: ${manifestPath}`);

    // Read and apply ownership line by line
    // Format expected: path|uid|gid|mode
    const script = `
while IFS='|' read -r path user group mode; do
  if [ -e "$path" ]; then
    sudo chown "$user:$group" "$path" 2>/dev/null || true
    sudo chmod "$mode" "$path" 2>/dev/null || true
  fi
done < "${manifestPath}"
`;

    await new Command().execCommand(script, ExecCommandMode.STDERR_AS_WARNING);

    this.logger.log('Ownership applied successfully from manifest');
  }
}
