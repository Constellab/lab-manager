import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { BucketConfig } from '../core/models/bucket-config.class';
import { SpawnResult } from '../core/services/command/command.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { RcloneService } from '../core/services/rclone/rclone.service';
import { CreateBackupDto, LabBackup, LabBackupHistory, LabBackupStorage } from './backup.class';

type BackupType = 'DATA' | 'DB';

@Injectable()
export class BackupService {

  private readonly backupHistoryFilename = 'backup-history.json';

  // destination folder for the backup is s3
  private readonly dataFolderDestination = '/data';
  private readonly dbFolderDestination = '/db'


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
    this.currentBackupStatus = new LabBackup();

    // add the unique storage
    this.currentBackupStatus.addStorage(
      new LabBackupStorage(createBackup.region, createBackup.bucket, createBackup.endpoint)
    );

    const bucketConfig: BucketConfig = {
      bucket: createBackup.bucket,
      endpoint: createBackup.endpoint,
      region: createBackup.region,
      accessKeyId: createBackup.credentials.accessKeyId,
      secretAccessKey: createBackup.credentials.secretAccessKey,
    }

    // Synchronize the DB
    const dbFolder = this.configService.getGwsCoreDbFolder();
    this.callSync(bucketConfig, dbFolder, this.dbFolderDestination, 'DB');

    // Synchronize the data
    const dataFolder = this.configService.getProdDataFolder();
    this.callSync(bucketConfig, dataFolder, this.dataFolderDestination, 'DATA');

    return this.currentBackupStatus;
  }

  private callSync(bucketConfig: BucketConfig, pathToSync: string,
    destinationFolder: string, backupType: BackupType): void {
    const response = this.rcloneService.syncFolder(bucketConfig, pathToSync, destinationFolder);
    // store process
    this.currentBackupProcess = response.childProcess;

    // listen to progress
    response.observable.subscribe(
      {
        next: (spawnResult: SpawnResult) => this.onProgress(spawnResult.data, backupType),
        error: (error: SpawnResult) => this.updateCurrentStatusStorageErrorMessage(error.data, backupType),
        complete: () => this.uploadCompleted(backupType),
      });
  }

  private onProgress(message: string, backupType: BackupType): void {
    if (!this.currentBackupProcess) return;
    // filter useful to only get the progess messages
    if (message.startsWith('Transferred') && message.includes('%')) {
      // remove the part of the message after text : 'Error'
      const index = message.indexOf('Error');
      if (index > 0) {
        message = message.substring(0, index);
      }
      this.currentBackupStatus.updateMessage(backupType, 'IN_PROGRESS', message);
    }
  }

  private updateCurrentStatusStorageErrorMessage(message: string, backupType: BackupType): void {
    if (!this.currentBackupProcess) return;
    this.onCompleted(backupType, 'ERROR', message);
  }

  private uploadCompleted(backupType: BackupType): void {
    if (!this.currentBackupProcess) return;
    this.onCompleted(backupType, 'SUCCESS', 'Backup completed');
  }

  private onCompleted(backupType: BackupType, status: 'SUCCESS' | 'ERROR', message: string): void {

    this.currentBackupStatus.updateMessage(backupType, status, message);

    // when all backup are completed, save the status
    if (this.currentBackupStatus.isFinished()) {
      this.currentBackupProcess = null;
      this.saveBackupStatus(this.currentBackupStatus);
    }
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