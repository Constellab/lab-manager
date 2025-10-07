import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { ConfigFileService } from '../../core/services/config-file/config-file.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { TaskService } from '../../core/services/task/task.service';
import { Command } from '../../core/utils/command';
import { DockerComposeService } from '../../docker/compose/docker-compose.service';

@Injectable()
export class BiotaService {
  private readonly logger = new Logger(BiotaService.name);

  private readonly pullBiotaTaskName = 'Downloading biota db';

  constructor(
    private fileService: FileService,
    private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private taskService: TaskService,
    private httpService: HttpService,
    private dockerComposeService: DockerComposeService
  ) {}

  public async pullBiota(forceUpdate: boolean = false, restartBiota: boolean = false): Promise<void> {
    if (!this.configFileService.biotaIsActive()) {
      this.logger.log('No biota db url found in the config file. Skipping pull biota');
      return;
    }

    const biotaDbFolder = this.getBiotaDbFolder();
    const mariaDbFolder = this.getMariaDbFolder();
    const biotaDbUrl = this.configFileService.readConfigFile().biota_maria_db_url;

    const zipFilePath = join(biotaDbFolder, 'mariadb.zip');

    // Check if the biota db is already downloaded in the right version
    if (!forceUpdate && !this.biotaDbNeedsToBePulled(biotaDbUrl)) {
      this.logger.log(`Biota db already downloaded in the right version : ${biotaDbUrl}. Skipping download`);
      return;
    }

    this.taskService.newTask(
      this.pullBiotaTaskName,
      `Pulling biota db from ${biotaDbUrl} into ${biotaDbFolder}`
    );

    try {
      this.fileService.createDirIfNotExists(biotaDbFolder, true);
      // stop the biota container because the volume will be deleted
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      await mainCompose.deleteBiotaService();

      // delete existing zip if exists
      this.fileService.deleteFileIfExist(zipFilePath);
      await this.downloadFile(biotaDbUrl, zipFilePath);

      // delete the old biota db folder
      this.fileService.deleteFolderIfExist(mariaDbFolder);

      // unzip the biota db
      await this.unzipBiotaDb(zipFilePath, biotaDbFolder);

      // update the private file to save the version of the biota db
      this.fileService.updatePrivateFileData({ biota_current_db_url_version: biotaDbUrl });

      this.fileService.deleteFileIfExist(zipFilePath);
      this.taskService.markTaskAsSuccess(this.pullBiotaTaskName, 'Biota db pulled successfully');
    } catch (e: any) {
      this.taskService.markTaskAsError(this.pullBiotaTaskName, 'Error during the biota pull. Error : ' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }

    if (restartBiota) {
      const taskName = 'Start biota service';
      this.taskService.newTask(taskName);

      try {
        const dockerCompose = this.dockerComposeService.createMainComposeObject();
        // start biota service from docker-compose
        await dockerCompose.startBiotaService();
        this.taskService.markTaskAsSuccess(taskName);
      } catch (e) {
        this.taskService.markTaskAsError(taskName, e.toString());
        throw e;
      }
    }
  }

  public downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination);
      const request = this.httpService.get(url, { responseType: 'stream' });

      request.subscribe({
        next: (response) => {
          const contentLength = parseInt(response.headers['content-length']);

          let loaded = 0;
          let lastProgressLogged = 0;

          // log progress
          response.data.on('data', (chunk) => {
            loaded += chunk.length;

            // log progress every 3%
            const progress = loaded / contentLength;
            if (progress - lastProgressLogged >= 0.03) {
              this.taskService.updateTaskInfo(
                this.pullBiotaTaskName,
                `Biota downloaded ${loaded} of ${contentLength} bytes. ${Math.round(progress * 100)}%`
              );
              lastProgressLogged = progress;
            }
          });

          // write to file
          response.data.pipe(file);

          // mark task as success when download is complete
          response.data.on('end', () => resolve());

          // mark task as error if download failed
          response.data.on('error', (err) => reject(err));
        },
        error: (error) => reject(error),
      });
    });
  }

  private async unzipBiotaDb(zipPath: string, destination: string): Promise<any> {
    try {
      this.taskService.updateTaskInfo(
        this.pullBiotaTaskName,
        `Unzipping biota db from ${zipPath} into ${destination}`
      );

      await new Command().execCommand(`unzip -q ${zipPath} -d ${destination}`);
    } catch (e: any) {
      this.taskService.markTaskAsError(this.pullBiotaTaskName, 'Error during the biota unzip. Error : ' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
    }
  }

  private getBiotaDbFolder(): string {
    return this.configService.getBiotaDbFolder();
  }

  private getMariaDbFolder(): string {
    return join(this.getBiotaDbFolder(), 'mariadb');
  }

  private biotaDbNeedsToBePulled(biotaDbUrl: string): boolean {
    const currentBiotaUrl = this.getCurrentVersionUrl();
    return !this.biotaDbExists() || currentBiotaUrl !== biotaDbUrl;
  }

  public getCurrentVersionUrl(): string {
    if (!this.fileService.privateFileExists()) return null;
    return this.fileService.readPrivateFile().data?.biota_current_db_url_version ?? null;
  }

  public biotaDbExists(): boolean {
    return this.fileService.exists(this.getMariaDbFolder());
  }
}
