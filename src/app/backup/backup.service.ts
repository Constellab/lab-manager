import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { BucketConfig } from '../core/models/bucket-config.class';
import { SpawnResult } from '../core/services/command/command.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { RcloneService } from '../core/services/rclone/rclone.service';
import { BackupInfoDto, LabBackup, LabBackupHistory, LabBackupStorage } from './backup.class';
import { ExternalLabApiService } from '../core/services/external-lab/external-lab-api.service';
import { Cron } from '@nestjs/schedule';
import { ExternalCentralApiService } from '../core/external-central/external-central-api.service';

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
  // max freqeuncy for the auto backup
  private static readonly BACKUP_FREQUENCY = 24 * 60 * 60 * 1000; // 24h
  // min idle time required (no activity on lab) before doing a backup
  private static readonly BACKUP_IDLE_ACTIVITY = 30 * 60 * 1000; // 30min

  private readonly logger = new Logger(BackupService.name);


  constructor(private configService: CoreConfigService,
    private rcloneService: RcloneService,
    private fileService: FileService,
    private externalLabService: ExternalLabApiService,
    private externalCentralService: ExternalCentralApiService) {
  }

  /**
   * The cron is triggered every hours to check if we need to do a backup
   * We do a backup if the previous backup is older than BACKUP_FREQUENCY,
   * if there is no running experiment in the lab
   * and if the last activity in the lab is older than BACKUP_IDLE_ACTIVITY
   * 
   */
  @Cron('0 0 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('[AutoBackup] Cron triggered');
    const lastHistory = this.getLastBackup();
    if (lastHistory) {

      const lastBackupDate = lastHistory.getFinishDate();
      if (this.currentBackupProcess || !lastHistory.isFinished() || lastBackupDate == null) {
        // if the last backup is not finished, we don't do anything
        this.logger.log('[AutoBackup] A backup is already running, skipping');
        return;
      }


      // check if the last backup is older than BACKUP_FREQUENCY
      const now = new Date();
      if (now.getTime() - lastBackupDate.getTime() < BackupService.BACKUP_FREQUENCY) {
        this.logger.log(`[AutoBackup] The last backup was finished at '${lastBackupDate.toISOString()}', skipping`);
        return;
      }

    }

    // checking that there is not running exp in the lab and the last activity is older than 30min
    try {
      const labActivity = await this.externalLabService.getGlobalActivity();

      if (labActivity.running_experiments > 0 || labActivity.queued_experiments > 0) {
        this.logger.log(`[AutoBackup] Running (${labActivity.running_experiments}) or queued experiments (${labActivity.queued_experiments}) detected, skipping`);
        return;
      }

      // check if the last activity is older than BACKUP_IDLE_ACTIVITY
      if (labActivity.last_activity) {
        const lastActivityDate = new Date(labActivity.last_activity.created_at);
        const now = new Date();
        if (now.getTime() - lastActivityDate.getTime() < BackupService.BACKUP_IDLE_ACTIVITY) {
          this.logger.log(`[AutoBackup] The last activity was detected at '${lastActivityDate.toISOString()}', skipping`);
          return;
        }
      }
    }
    catch (e) {
      // for now we still run the backup even if we can't get the activity
      this.logger.error(`[AutoBackup] Error while getting the lab activity: ${e.message}. Running the backup anyway`);
    }


    try {
      const backupInfo = await this.externalCentralService.getBackupInfo();
      // we can do the backup
      this.logger.log('[AutoBackup] Starting backup');
      this.createProdBackup(backupInfo);
    } catch (e) {
      this.logger.error(`[AutoBackup] Error while getting the backup info: ${e.message}, skipping`);
      return;
    }
  }

  public async checkAndCreateProdBackup(createBackup: BackupInfoDto): Promise<LabBackup> {

    try {
      const labActivity = await this.externalLabService.getGlobalActivity();

      if (labActivity.running_experiments > 0){
        throw new BadRequestException("There is a running experiment in the lab, please stop it before doing a backup")
      } 
      
      if(labActivity.queued_experiments > 0){
        throw new BadRequestException(`There is ${labActivity.queued_experiments} experiments in the queue in the lab, please remove them from queue before doing a backup`)
      }

    }
    catch (e) {
      // for now we still run the backup even if we can't get the activity
      this.logger.error(`Error while getting the lab activity: ${e.message}. Running the backup anyway`);
    }

    return this.createProdBackup(createBackup);
  }

  private createProdBackup(createBackup: BackupInfoDto): LabBackup {

    if (this.currentBackupProcess) {
      throw new BadRequestException('A backup is already running');
    }

    // for now only support one bucket
    const bucket = createBackup.buckets[0]

    // init backup status
    this.currentBackupStatus = new LabBackup();

    // add the unique storage
    this.currentBackupStatus.addStorage(
      new LabBackupStorage(bucket.region, bucket.bucket, bucket.endpoint)
    );

    const bucketConfig: BucketConfig = {
      bucket: bucket.bucket,
      endpoint: bucket.endpoint,
      region: bucket.region,
      accessKeyId: bucket.credentials.accessKeyId,
      secretAccessKey: bucket.credentials.secretAccessKey,
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
      const content = this.fileService.readJsonFile(filePath);
      return LabBackupHistory.fromJson(content);
    } else {
      return null;
    }
  }

  public getLastBackup(): LabBackup {
    const history = this.getBackupHistory();
    if (history && history.backups.length > 0) {
      return history.backups[history.backups.length - 1];
    }
    return null;
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
    return new LabBackupHistory();
  }
}

