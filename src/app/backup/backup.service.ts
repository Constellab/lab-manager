import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { BucketConfig } from '../core/models/bucket-config.class';
import { SpawnResult } from '../core/services/command/command.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { RcloneService } from '../core/services/rclone/rclone.service';
import { CreateBackupDto, LabBackup, LabBackupHistory } from './backup.class';


@Injectable()
export class BackupService {

  private backupHistoryFilename = 'backup-history.json';


  private currentBackupStatus: LabBackup;
  private currentBackupProcess: ChildProcess;

  private static readonly MAX_BACKUP_HISTORY = 30;

  constructor(private configService: CoreConfigService,
    private rcloneService: RcloneService,
    private fileService: FileService) {
  }

  public createProdBackup(createBackup: CreateBackupDto): LabBackup {

    if (this.currentBackupProcess) {
      throw new BadRequestException('A backup is already running');
    }

    // init backup status
    this.currentBackupStatus = {
      status: 'IN_PROGRESS',
      message: 'Backup started',
      storages: [{
        bucket: createBackup.bucket,
        region: createBackup.region,
        endpoint: createBackup.endpoint,
        status: 'IN_PROGRESS',
        message: 'Backup started',
        startUploadAt: new Date(),
      }],
    }

    const dataFolder = this.configService.getProdDataFolder()

    const config: BucketConfig = {
      bucket: createBackup.bucket,
      endpoint: createBackup.endpoint,
      region: createBackup.region,
      accessKeyId: createBackup.credentials.accessKeyId,
      secretAccessKey: createBackup.credentials.secretAccessKey,
    }


    const response = this.rcloneService.syncFolder(config, dataFolder);
    // store process
    this.currentBackupProcess = response.childProcess;

    // listen to progress
    response.observable.subscribe(
      {
        next: (spawnResult: SpawnResult) => this.updateCurrentStatusMessage(spawnResult.data),
        error: (error: SpawnResult) => this.updateCurrentStatusStorageErrorMessage(error.data),
        complete: () => this.uploadCompleted(),
      });


    return this.currentBackupStatus;
  }

  private updateCurrentStatusMessage(message: string): void {
    if (!this.currentBackupProcess) return;
    this.currentBackupStatus.message = message;
    this.currentBackupStatus.storages[0].message = message;
  }

  private updateCurrentStatusStorageErrorMessage(message: string): void {
    if (!this.currentBackupProcess) return;
    this.currentBackupStatus.message = message;
    this.currentBackupStatus.storages[0].message = message;
    this.currentBackupStatus.status = 'ERROR';
    this.currentBackupStatus.storages[0].status = 'ERROR';
    this.currentBackupStatus.storages[0].endUploadAt = new Date();
    this.saveBackupStatus(this.currentBackupStatus);
  }

  private uploadCompleted(): void {
    if (!this.currentBackupProcess) return;
    this.currentBackupStatus.message = 'Backup completed';
    this.currentBackupStatus.storages[0].message = 'Backup completed';
    this.currentBackupStatus.status = 'DONE';
    this.currentBackupStatus.storages[0].status = 'DONE';
    this.currentBackupStatus.storages[0].endUploadAt = new Date();
    this.currentBackupProcess = null;
    this.saveBackupStatus(this.currentBackupStatus);
  }


  public getCurrentBackupStatus(): LabBackup {
    return this.currentBackupStatus;
  }

  public getBackupHistory(): LabBackupHistory {
    const filePath = this.backupHistoryPath();
    if (this.fileService.exists(filePath)) {
      return this.fileService.readJsonFile(filePath);
    } else {
      return null;
    }
  }


  public stopCurrentBackup(): boolean {
    if (this.currentBackupProcess) {
      return this.currentBackupProcess.kill();
    }
    return false;
  }

  private saveBackupStatus(backup: LabBackup): void {
    const filePath = this.backupHistoryPath();
    let json: LabBackupHistory = null;
    if (this.fileService.exists(filePath)) {
      try {
        json = this.fileService.readJsonFile(filePath);
      } catch (e) {
        Logger.error('Error while reading backup history file', e);
        json = this.initBackupHistory();
      }
    } else {
      json = this.initBackupHistory();
    }

    try {
      json.backups.push(backup);

      // keep only the last 30 backups
      json.backups = json.backups.slice(-BackupService.MAX_BACKUP_HISTORY);
      this.fileService.writeJsonFile(filePath, json);
    } catch (e) {
      Logger.error('Error while writing backup history file', e);
    }
  }

  private backupHistoryPath(): string {
    return this.configService.getProdSettingsFolder() + '/' + this.backupHistoryFilename;
  }

  private initBackupHistory(): LabBackupHistory {
    return {
      version: 1,
      backups: [],
    }
  }
}