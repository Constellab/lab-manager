import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SpawnResult } from '../core/services/command/command.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { RcloneService } from '../core/services/rclone/rclone.service';
import { BackupBucketDTO, BackupFrequency, BackupInfoDTO, BackupTriggerMode, LabBackupStorage, LabBackupStorageI } from './backup.class';
import { ExternalLabApiService } from '../core/services/external-lab/external-lab-api.service';
import { Cron } from '@nestjs/schedule';
import { ExternalCentralApiService } from '../core/external-central/external-central-api.service';
import { LabBackupHistory } from './backup-history.class';
import { ContainerService } from '../docker/container/container.service';

type BackupType = 'DATA' | 'DB';

@Injectable()
export class BackupService implements OnModuleInit {

  private readonly backupHistoryFilename = 'backup-history.json';

  // destination folder for the backup is s3
  private readonly dataFolderDestination = '/data';
  private readonly dbFolderDestination = '/db';
  // path of the DB dump inside mariadb container
  private readonly dbDumName = 'dump.sql';
  // path of the database inside mariadb container, which is shared with volume of this container
  private readonly dbDumpMariaDbPath = '/var/lib/mysql';
  private readonly dbDumpFolder = '.dumps';


  private static readonly MAX_BACKUP_HISTORY = 30;
  // min idle time required (no activity on lab) before doing a backup
  private static readonly BACKUP_IDLE_ACTIVITY = 30 * 60 * 1000; // 30min

  // verison of the info sent by central supported by this version of the lab manager
  private static readonly SUPPORTED_BACKUP_INFO_VERSION = 1;

  private readonly logger = new Logger(BackupService.name);

  private backupHistory: LabBackupHistory = null;


  constructor(private configService: CoreConfigService,
    private rcloneService: RcloneService,
    private fileService: FileService,
    private externalLabService: ExternalLabApiService,
    private externalCentralService: ExternalCentralApiService,
    private containerService: ContainerService) {
  }

  /**
   * On start, check if there are some backup mark as running, if yes, mark them as error
   */
  onModuleInit(): void {
    this.migrateBackupHistory();
    const backupHistory = this.getBackupHistory();

    // check if there is a running backup, to mark it as error
    for (const running of backupHistory.getRunningBackups()) {
      if (running.dbStatus.status === 'IN_PROGRESS') {
        this.updateCurrentStatusStorageErrorMessage('The lab was restarted while the backup was running, the backup has been stopped', 'DB', running);
      }
      if (running.dataStatus.status === 'IN_PROGRESS') {
        this.updateCurrentStatusStorageErrorMessage('The lab was restarted while the backup was running, the backup has been stopped', 'DATA', running);
      }
    }

    // save the history and send history to central server
    this.saveBackupHistory(backupHistory);

    this.logger.log('Syncing backup history with central server')
    this.externalCentralService.syncBackupHistory(backupHistory.backups.map(b => b.toJson())).catch(
      e => this.logger.error(`Error while syncing the backup history with the central server. Error : ${e.message}`)
    );
    this.logger.log('Syncing backup history with central server done')
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

    try {
      const backupInfo = await this.externalCentralService.getBackupInfo();

      // we can do the backup
      this.createMultipleProdBackup(backupInfo, 'AUTOMATIC');
    } catch (e) {
      this.logger.error(`[AutoBackup] Error while getting the backup info: ${e.message}, skipping`);
      return;
    }
  }

  public async checkAndCreateProdBackup(createBackup: BackupInfoDTO): Promise<LabBackupStorage[]> {
    return this.createMultipleProdBackup(createBackup, 'MANUAL');
  }

  private async createMultipleProdBackup(createBackup: BackupInfoDTO, triggerMode: BackupTriggerMode): Promise<LabBackupStorage[]> {
    if (createBackup.version !== BackupService.SUPPORTED_BACKUP_INFO_VERSION) {
      throw new BadRequestException(`The backup info version '${createBackup.version}' is not supported by this version of the lab manager`);
    }

    if (this.hasRunningBackup()) {
      throw new BadRequestException(`A backup is already running`);
    }

    // simple check to see if the lab was not encrypted by a ransomware
    this.checkRansomware();

    try {
      const labActivity = await this.externalLabService.getGlobalActivity();

      if (labActivity.running_experiments > 0) {
        throw new BadRequestException("There is a running experiment in the lab, please stop it before doing a backup")
      }

      if (labActivity.queued_experiments > 0) {
        throw new BadRequestException(`There is ${labActivity.queued_experiments} experiments in the queue in the lab, please remove them from queue before doing a backup`)
      }

      if (triggerMode === 'AUTOMATIC') {
        // check if the last activity is older than BACKUP_IDLE_ACTIVITY
        if (labActivity.last_activity) {
          const lastActivityDate = new Date(labActivity.last_activity.created_at);
          const now = new Date();
          if (now.getTime() - lastActivityDate.getTime() < BackupService.BACKUP_IDLE_ACTIVITY) {
            this.logger.log(`[Backup][${triggerMode}] The last activity was detected at '${lastActivityDate.toISOString()}', skipping`);
            return;
          }
        }
      }
    }
    catch (e) {
      // for now we still run the backup even if we can't get the activity
      this.logger.error(`Error while getting the lab activity: ${e.message}. Running the backup anyway`);
    }

    // delete the DB dump if it exists
    this.fileService.deleteFolderIfExist(this.getDbDumpPathInCurrentContainer());

    const backupHistory = this.getBackupHistory();

    const backups: LabBackupStorage[] = [];
    for (const bucket of createBackup.backupBuckets) {

      // check if the last backup is expired 
      if (triggerMode === 'AUTOMATIC') {

        const lastBackup = backupHistory.getLastBackupByFrequency(bucket.backupFrequency);
        if (lastBackup && lastBackup.backupIsExpired()) {
          this.logger.log(`[AutoBackup] The last backup was finished at '${lastBackup.endUploadAt.toISOString()}' with frequency ${lastBackup.frequency}, skipping`);
          continue;
        }
      }

      backups.push(this.createProdBackup(bucket, triggerMode));
    }
    return backups;
  }



  private createProdBackup(backupBucketDto: BackupBucketDTO, triggerMode: BackupTriggerMode): LabBackupStorage {

    // add the unique storage
    const backup = new LabBackupStorage(backupBucketDto.bucketConfig.region, backupBucketDto.bucketConfig.bucket, backupBucketDto.bucketConfig.endpoint,
      backupBucketDto.backupFrequency, triggerMode);
    backup.setAccessKeys(backupBucketDto.bucketConfig.credentials.accessKeyId, backupBucketDto.bucketConfig.credentials.secretAccessKey);

    this.logger.log(`[Backup][${backup.triggerMode}] Starting backup for region '${backup.region}', bucket '${backup.bucket}, frequency '${backup.frequency}', id '${backup.id}'`);
    // add the backup to the history
    this.saveBackupStatusToHistory(backup);

    // Synchronize the DB
    this.syncDb(backup).catch(e => {
      this.logger.error(`Error while syncing the DB. Error : ${e.message}`);
      if (backup.dbStatus.status === 'IN_PROGRESS') {
        this.updateCurrentStatusStorageErrorMessage(`Error while syncing the DB. Error : ${e.message}`, 'DB', backup);
      }
    });

    // Synchronize the data
    this.syncData(backup).catch(e => {
      this.logger.error(`Error while syncing the data. Error : ${e.message}`);
      if (backup.dataStatus.status === 'IN_PROGRESS') {
        this.updateCurrentStatusStorageErrorMessage(`Error while syncing the data. Error : ${e.message}`, 'DATA', backup);
      }
    });

    return backup;
  }

  /**
   * Sync the DB with the bucket. It creates a dump of the DB and sync the file with the bucket
   */
  private async syncDb(backup: LabBackupStorage): Promise<void> {
    // retrieve the path of the dump in the current container volume
    const dumpPathInCurrentContainer = this.getDbDumpPathInCurrentContainer();

    if (!this.fileService.exists(dumpPathInCurrentContainer)) {
      // dump the db
      this.fileService.createDirIfNotExists(this.getDbDumpFolderInCurrentContainer());
      const result = await this.containerService.dumpProdDb(this.getDumpMariaDbPathInMariaDbContainer());
      if (result !== '') {
        this.updateCurrentStatusStorageErrorMessage(`Error while dumping the DB. Error : ${result}`, 'DB', backup)
        return;
      }
    }


    // get the dump size
    const dumpSize = this.fileService.getFileSize(dumpPathInCurrentContainer);
    backup.dbSize = dumpSize;

    // sync the dump folder with the bucket
    this.callSync(backup, this.getDbDumpFolderInCurrentContainer(), this.dbFolderDestination, 'DB');
  }

  /**
   * @returns Get the path of the DB dump inside the mariadb container
   */
  private getDumpMariaDbPathInMariaDbContainer(): string {
    return this.dbDumpMariaDbPath + '/' + this.dbDumName;
  }

  private getDbDumpFolderInCurrentContainer(): string {
    return this.configService.getGwsCoreDbProdMariaDbFolder() + '/' + this.dbDumpFolder;
  }

  /**
   * @returns Get the path of the DB dump inside the current container
   */
  private getDbDumpPathInCurrentContainer(): string {
    return this.getDbDumpFolderInCurrentContainer() + '/' + this.dbDumName;
  }


  private async syncData(backup: LabBackupStorage): Promise<void> {
    // Synchronize the data
    const dataFolder = this.configService.getProdDataFolder();

    try {
      // get folder size 
      const dataSize = await this.fileService.getFolderSize(dataFolder);
      backup.dataSize = dataSize;
    } catch (e) {
      this.logger.error(`Error while getting the data folder size. Error : ${e.message}`);
    }

    this.callSync(backup, dataFolder, this.dataFolderDestination, 'DATA');
  }


  private callSync(backup: LabBackupStorage, pathToSync: string,
    destinationFolder: string, backupType: BackupType): void {
    const response = this.rcloneService.syncFolder(backup.getBucketConfig(), pathToSync, destinationFolder);
    // store process
    backup.setProcess(backupType, response.childProcess);

    // listen to progress
    response.observable.subscribe(
      {
        next: (spawnResult: SpawnResult) => this.onProgress(spawnResult.data, backupType, backup),
        error: (error: SpawnResult) => this.updateCurrentStatusStorageErrorMessage(error.data, backupType, backup),
        complete: () => this.uploadCompleted(backupType, backup),
      });
  }

  private onProgress(message: string, backupType: BackupType, backup: LabBackupStorage): void {
    // filter useful to only get the progess messages
    if (message.startsWith('Transferred') && message.includes('%')) {
      // remove the part of the message after text : 'Error'
      const index = message.indexOf('Error');
      if (index > 0) {
        message = message.substring(0, index);
      }
      backup.updateMessage(backupType, 'IN_PROGRESS', message);
    }
  }

  private updateCurrentStatusStorageErrorMessage(message: string, backupType: BackupType, backup: LabBackupStorage): void {
    this.onCompleted(backupType, 'ERROR', message, backup);
  }

  private uploadCompleted(backupType: BackupType, backup: LabBackupStorage): void {
    this.onCompleted(backupType, 'SUCCESS', 'Backup completed', backup);
  }

  private onCompleted(backupType: BackupType, status: 'SUCCESS' | 'ERROR', message: string,
    backup: LabBackupStorage): void {

    backup.updateMessage(backupType, status, message);

    // when all backup are completed, save the status
    if (backup.isFinished()) {
      this.saveBackupStatusToHistory(backup);
      this.logger.log(`[Backup][${backup.triggerMode}] Backup finished for region '${backup.region}', bucket '${backup.bucket}, frequency '${backup.frequency}, id '${backup.id}'`);
    }

    // if there is no running backup, delete the DB dump
    if (!this.hasRunningBackup()) {
      this.fileService.deleteFolderIfExist(this.getDbDumpFolderInCurrentContainer());
    }
  }


  public getCurrentBackupStatus(): LabBackupStorage[] {
    const backupHistory = this.getBackupHistory();
    if (backupHistory.hasRunningBackup) {
      return backupHistory.getRunningBackups();
    }

    return backupHistory.getLastBackupsForEachFrequency();
  }


  public stopCurrentBackups(): LabBackupStorage[] {

    const backupHistory = this.getBackupHistory();
    if (!backupHistory.hasRunningBackup()) return [];

    const runningBackups = backupHistory.getRunningBackups();
    for (const backup of runningBackups) {
      if (backup.dbProcess) {
        backup.dbProcess.kill();
      }
      if (backup.dataProcess) {
        backup.dataProcess.kill();
      }

      if (backup.dataStatus.status === 'IN_PROGRESS') {
        this.onCompleted('DATA', 'ERROR', 'Backup stopped manually', backup);
      }
      if (backup.dbStatus.status === 'IN_PROGRESS') {
        this.onCompleted('DB', 'ERROR', 'Backup stopped manually', backup);
      }
    }
    return runningBackups;
  }


  // Simple check to see if the lab was not encrypted by a ransomware
  // We check if we can read the private file and docker-compose file 
  private checkRansomware(): void {
    try {
      this.fileService.readPrivateFile();
    }
    catch (e) {
      throw new BadRequestException('The private file does not exist, or could not be read. Maybe it has been encrypted by a ransomware');
    }

    const dockerCompose = this.fileService.readDockerComposeTemplate();

    if (!dockerCompose.includes('image')) {
      throw new BadRequestException('The docker-compose file does not contain any image, please check your docker-compose file. Maybe it has been encrypted by a ransomware');
    }
  }


  /////////////////////////// BACKUP HISTORY ///////////////////////////

  private saveBackupStatusToHistory(backup: LabBackupStorage): void {
    const backupHistory: LabBackupHistory = this.getBackupHistory();

    try {
      backupHistory.updateBackup(backup);

      this.saveBackupHistory(backupHistory);

      this.externalCentralService.syncBackupHistory([backup.toJson()]).catch(
        e => this.logger.error(`Error while syncing the backup history with the central server. Error : ${e.message}`)
      );
    } catch (e) {
      Logger.error('Error while writing backup history file', e);
    }
  }

  private saveBackupHistory(backupHistory: LabBackupHistory): void {
    // keep only the last 30 backups
    backupHistory.backups = backupHistory.backups.slice(-BackupService.MAX_BACKUP_HISTORY);
    const filePath = this.backupHistoryPath();
    this.fileService.writeJsonFile(filePath, backupHistory.toJson());
    this.backupHistory = backupHistory;
  }

  private backupHistoryPath(): string {
    return this.configService.getProdSettingsFolder() + '/' + this.backupHistoryFilename;
  }


  // todo history migration, to remove once all labs uses v1.3.2
  private migrateBackupHistory(): void {
    const history: any = this.getBackupHistory();

    if (history.version >= 2) return;

    this.logger.log('Migrating backup history to v2');

    const newBackupHistory = new LabBackupHistory();

    // store each backup individually
    for (const backup of history.backups) {
      if (backup.storages && backup.storages.length > 0) {
        for (const storage of backup.storages) {
          // set the frequency and trigger mode
          storage.frequency = 'DAILY' as BackupFrequency;
          storage.triggerMode = 'AUTO' as BackupTriggerMode;
          storage.dataSize = 0;
          storage.dbSize = 0;
          newBackupHistory.backups.push(storage);
        }
      }
    }

    const filePath = this.backupHistoryPath();
    this.fileService.writeJsonFile(filePath, newBackupHistory.toJson());
    this.backupHistory = newBackupHistory;
  }

  public getBackupHistory(): LabBackupHistory {
    if (this.backupHistory == null) {
      const filePath = this.backupHistoryPath();
      if (this.fileService.exists(filePath)) {
        try {
          const content = this.fileService.readJsonFile(filePath);
          this.backupHistory = LabBackupHistory.fromJson(content);
        } catch (e) {
          Logger.error('Error while reading backup history file', e);
          this.backupHistory = new LabBackupHistory();
        }
      } else {
        this.backupHistory = new LabBackupHistory();
      }
    }

    return this.backupHistory;
  }

  public hasRunningBackup(): boolean {
    return this.getBackupHistory().hasRunningBackup();
  }



}

