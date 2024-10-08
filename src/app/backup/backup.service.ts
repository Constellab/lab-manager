import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SpawnResult } from '../core/services/command/command.service';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { FileService } from '../core/services/file/file.service';
import { RcloneService } from '../core/services/rclone/rclone.service';
import { BackupBucketDTO, BackupInfoDTO, BackupRestoreDTO, BackupTriggerMode, LabBackupStorage } from './backup.class';
import { ExternalLabApiService } from '../core/services/external-lab/external-lab-api.service';
import { Cron } from '@nestjs/schedule';
import { ExternalSpaceApiService } from '../core/external-space/external-space-api.service';
import { LabBackupHistory } from './backup-history.class';
import { ContainerService } from '../docker/container/container.service';
import { join } from 'path';
import { TaskService } from '../core/services/task/task.service';
import { Observable, lastValueFrom, tap } from 'rxjs';
import { RCloneResult } from '../core/services/rclone/rclone.class';
import { rxjsDebug } from '../core/utils/rxjs-debug';

type BackupType = 'DATA' | 'DB';

@Injectable()
export class BackupService implements OnModuleInit {

  private readonly backupHistoryFilename = 'backup-history.json';

  // destination folder for the backup is s3
  private readonly dataS3FolderDestination = 'data';
  private readonly dbS3FolderDestination = 'db';
  // path of the DB dump inside mariadb container
  private readonly dbDumpName = 'dump.sql';
  // path of the database inside mariadb container, which is shared with volume of this container
  private readonly dbDumpMariaDbPath = '/var/lib/mysql';
  private readonly dbDumpFolder = '.dumps';


  private static readonly MAX_BACKUP_HISTORY = 30;
  // min idle time required (no activity on lab) before doing a backup
  private static readonly BACKUP_IDLE_ACTIVITY = 30 * 60 * 1000; // 30min

  // verison of the info sent by space supported by this version of the lab manager
  private static readonly SUPPORTED_BACKUP_INFO_VERSION = 1;

  private static readonly RESTORE_BACKUP_TASK = 'RESTORE BACKUP';

  private readonly logger = new Logger(BackupService.name);

  private backupHistory: LabBackupHistory = null;


  constructor(private configService: CoreConfigService,
    private rcloneService: RcloneService,
    private fileService: FileService,
    private externalLabService: ExternalLabApiService,
    private externalSpaceService: ExternalSpaceApiService,
    private containerService: ContainerService,
    private taskService: TaskService) {
  }

  /**
   * On start, check if there are some backup mark as running, if yes, mark them as error
   */
  onModuleInit(): void {
    try{

      if (!this.fileService.privateFileExists()) return;
      const backupHistory = this.getBackupHistory();

      // check if there is a running backup, to mark it as error
      for (const running of backupHistory.getRunningBackups()) {
        if (running.getDbStatus() === 'IN_PROGRESS') {
          this.updateCurrentStatusStorageErrorMessage('The lab was restarted while the backup was running, the backup has been stopped',
            'DB', running);
        }
        if (running.getDataStatus() === 'IN_PROGRESS') {
          this.updateCurrentStatusStorageErrorMessage('The lab was restarted while the backup was running, the backup has been stopped',
            'DATA', running);
        }
      }

      // save the history and send history to space server
      this.saveBackupHistory(backupHistory);

      this.logger.log('Syncing backup history with space server')
      this.externalSpaceService.syncBackupHistory(backupHistory).catch(
        e => this.logError(`Error while syncing the backup history with the space server. Error : ${e.message}`, e)
      );
      this.logger.log('Syncing backup history with space server done')
    } catch(e){
      this.logError(`Error during backup module init. Error : ${e.message}`, e)
    }
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
    if (!this.fileService.privateFileExists()) return;

    const privateFile = this.fileService.readPrivateFile();
    if (privateFile.backup && !privateFile.backup.enable) return;

    this.logger.log('[AutoBackup] Cron triggered');

    let backupInfo: BackupInfoDTO;
    try {

      backupInfo = await this.externalSpaceService.getBackupInfo();
    } catch (e) {
      this.logError(`[AutoBackup] Error while getting the backup info: ${e.message}, skipping`, e);
      return;
    }

    try {

      // we can do the backup
      await this.createMultipleProdBackup(backupInfo, 'AUTOMATIC');
    } catch (e) {
      this.logError(`[AutoBackup] Error while creating the backup : ${e.message}, skipping`, e);
      return;
    }
  }

  public async createMultipleProdBackup(createBackup: BackupInfoDTO, triggerMode: BackupTriggerMode): Promise<LabBackupHistory> {
    if (createBackup.version !== BackupService.SUPPORTED_BACKUP_INFO_VERSION) {
      throw new BadRequestException(`The backup info version '${createBackup.version}' ` +
        `is not supported by this version of the lab manager`);
    }

    if (this.hasRunningBackup()) {
      throw new BadRequestException(`A backup is already running`);
    }

    if (!createBackup.s3Prefix) {
      throw new BadRequestException(`The s3 prefix is not defined`);
    }

    // simple check to see if the lab was not encrypted by a ransomware
    this.checkRansomware();

    // check if the prod db is running
    if (!await this.containerService.prodDbIsRunning()) {
      throw new BadRequestException('The prod DB is not running, please start the lab before doing a backup');
    }

    try {
      const labActivity = await this.externalLabService.getGlobalActivity();

      if (labActivity.running_experiments > 0) {
        throw new BadRequestException("There is a running experiment in the lab, please stop it before doing a backup")
      }

      if (labActivity.queued_experiments > 0) {
        throw new BadRequestException(`There is ${labActivity.queued_experiments} experiments in ` +
          `the queue in the lab, please remove them from queue before doing a backup`)
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
      this.logError(`Error while getting the lab activity: ${e.message}. Running the backup anyway`, e);
    }

    // delete the DB dump if it exists
    this.fileService.deleteFolderIfExist(this.getDbDumpPathInCurrentContainer());

    const backupHistory = this.getBackupHistory();

    // get the list of backup to trigger
    const backupToTrigger = backupHistory.getBackupToTrigger(createBackup.backupBuckets,
      triggerMode === 'MANUAL');

    const backups: LabBackupStorage[] = [];


    for (const bucket of backupToTrigger) {
      backups.push(this.createProdBackup(bucket, triggerMode, createBackup.s3Prefix));
    }

    return new LabBackupHistory(backups);
  }


  private createProdBackup(backupBucketDto: BackupBucketDTO, triggerMode: BackupTriggerMode, s3Prefix: string): LabBackupStorage {

    // add the unique storage
    const backup = new LabBackupStorage( triggerMode, s3Prefix);
    backup.setBackupBucketDto(backupBucketDto);

    this.logger.log(`[Backup][${backup.triggerMode}] Starting backup for region '${backup.getRegion()}', ` +
      `bucket '${backup.getBucketName()}, frequency '${backup.frequency}', id '${backup.id}'`);
    // add the backup to the history
    this.saveBackupStatusToHistory(backup);

    // Synchronize the DB
    this.syncDb(backup).catch(e => {
      this.logError(`Error while syncing the DB. Error : ${e.message}`, e);
      if (backup.getDbStatus() === 'IN_PROGRESS') {
        this.updateCurrentStatusStorageErrorMessage(`Error while syncing the DB. Error : ${e.message}`, 'DB', backup);
      }
    });

    // Synchronize the data
    this.syncData(backup).catch(e => {
      this.logError(`Error while syncing the data. Error : ${e.message}`, e);
      if (backup.getDataStatus() === 'IN_PROGRESS') {
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
    backup.setDbTotalSize(dumpSize);

    // sync the dump folder with the bucket
    this.callSyncToS3(backup, this.getDbDumpFolderInCurrentContainer(), this.dbS3FolderDestination, 'DB');
  }

  /**
   * @returns Get the path of the DB dump inside the mariadb container
   */
  private getDumpMariaDbPathInMariaDbContainer(): string {
    return join(this.dbDumpMariaDbPath, this.dbDumpFolder, this.dbDumpName);
  }

  private getDbDumpFolderInCurrentContainer(): string {
    return join(this.configService.getGwsCoreDbProdMariaDbFolder(), this.dbDumpFolder);
  }

  /**
   * @returns Get the path of the DB dump inside the current container
   */
  private getDbDumpPathInCurrentContainer(): string {
    return join(this.getDbDumpFolderInCurrentContainer(), this.dbDumpName);
  }


  private async syncData(backup: LabBackupStorage): Promise<void> {
    // Synchronize the data
    const dataFolder = this.configService.getProdDataFolder();

    try {
      // get folder size 
      const dataSize = await this.fileService.getFolderSize(dataFolder);
      backup.setDataTotalSize(dataSize);
    } catch (e) {
      this.logError(`Error while getting the data folder size. Error : ${e.message}`, e);
    }

    this.callSyncToS3(backup, dataFolder, this.dataS3FolderDestination, 'DATA');
  }


  private callSyncToS3(backup: LabBackupStorage, pathToSync: string,
                       destinationFolder: string, backupType: BackupType): void {
    const response = this.rcloneService.syncFolderToS3(backup.getBucketConfig(), pathToSync, backup.s3Prefix + '/' + destinationFolder);
    // store process
    backup.setProcess(backupType, response.childProcess);

    // listen to progress
    response.observable.pipe(rxjsDebug()).subscribe(
      {
        next: (result) => this.onProgress(result, backupType, backup),
        error: (error: SpawnResult) => this.updateCurrentStatusStorageErrorMessage(error.data, backupType, backup),
        complete: () => this.uploadCompleted(backupType, backup),
      });
  }

  private onProgress(result: RCloneResult, backupType: BackupType, backup: LabBackupStorage): void {
    if(result.type === 'finalStats'){
      backup.setStats(backupType, result.data.stats);
    }
    else{
      backup.updateMessage(backupType, 'IN_PROGRESS', result.data);
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
      this.logger.log(`[Backup][${backup.triggerMode}] Backup finished for region '${backup.getRegion()}', ` + 
        `bucket '${backup.getBucketName()}', frequency '${backup.frequency}, id '${backup.id}'`);
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

      if (backup.getDataStatus() === 'IN_PROGRESS') {
        this.onCompleted('DATA', 'ERROR', 'Backup stopped manually', backup);
      }
      if (backup.getDbStatus() === 'IN_PROGRESS') {
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
      throw new BadRequestException('The docker-compose file does not contain any image, please check your '+ 
        'docker-compose file. Maybe it has been encrypted by a ransomware');
    }
  }


  /////////////////////////// BACKUP HISTORY ///////////////////////////

  private saveBackupStatusToHistory(backup: LabBackupStorage): void {
    const backupHistory: LabBackupHistory = this.getBackupHistory();

    try {
      backupHistory.updateBackup(backup);

      this.saveBackupHistory(backupHistory);

      this.externalSpaceService.syncBackupHistory(new LabBackupHistory([backup])).catch(
        e => this.logError(`Error while syncing the backup history with the space server. Error : ${e.message}`, e)
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



  /////////////////////////////////////// RESTORE BACKUP ///////////////////////////////////////


  public async restoreBackup(restoreDTO: BackupRestoreDTO): Promise<void> {
    // Synchronize the data
    const dataFolder = this.configService.getProdDataFolder();

    if (!restoreDTO.options.force) {
      // if the data folder is not empty, we stop the restore
      if (this.fileService.exists(dataFolder) && !this.fileService.folderIsEmpty(dataFolder)) {
        throw new BadRequestException('The data folder is not empty, please delete the data folder before restoring a backup');
      }
    }

    this.taskService.newTask(BackupService.RESTORE_BACKUP_TASK);

    try {

      if (restoreDTO.options.restoreDb) {
        // restore the DB
        await this.restoreDb(restoreDTO);
      }


      if (restoreDTO.options.restoreData) {
        // restore the data
        this.restoreData(restoreDTO).subscribe({
          error: (error: SpawnResult) => this.onRestoreBackupError(error.data),
          complete: () => this.onRestoreBackupSuccess()
        })
      } else {
        this.onRestoreBackupSuccess();
      }

    } catch (e) {
      const error = e.data ?? e.message ?? e.toString();
      this.taskService.markTaskAsError(BackupService.RESTORE_BACKUP_TASK, error);
      throw Error(error);
    }
  }

  private restoreData(restoreDTO: BackupRestoreDTO): Observable<RCloneResult> {
    this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, 'Starting restore of the DB');
    const dataFolder = this.configService.getProdDataFolder();

    // sync the data folder with the bucket
    return this.callSyncFromS3(restoreDTO, this.dataS3FolderDestination, dataFolder).pipe(
      tap({
        complete: () => this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, 'Data Restored')
      })
    );
  }

  private async restoreDb(restoreDTO: BackupRestoreDTO): Promise<void> {
    this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, 'Starting restore of the DB');
    // retrieve the path of the dump in the current container volume
    const dumpFolderInCurrentContainer = this.getDbDumpFolderInCurrentContainer();

    // delete the DB dump if it exists
    this.fileService.deleteFolderIfExist(dumpFolderInCurrentContainer);

    this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, `Downloading DB dump from S3 into ${dumpFolderInCurrentContainer}`);
    // sync db file into the container
    const obs = this.callSyncFromS3(restoreDTO, this.dbS3FolderDestination, dumpFolderInCurrentContainer);
    // wait for the download to complete
    await lastValueFrom(obs);

    this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, 'Applying the DB dump');

    // restore the DB
    const dbPathInMariaDb = this.getDumpMariaDbPathInMariaDbContainer();
    await this.containerService.restoreProdDb(dbPathInMariaDb);

    this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, 'DB Restored');
  }

  private callSyncFromS3(restoreDTO: BackupRestoreDTO, s3SourceFolder: string,
                         localDestinationPath: string): Observable<RCloneResult> {

    const response = this.rcloneService.syncFolderFromS3(restoreDTO.bucketConfig,
      restoreDTO.s3Prefix + '/' + s3SourceFolder, localDestinationPath);

    // listen to progress
    return response.observable.pipe(
      tap((spawnResult) => this.onRestoreProgress(spawnResult))
    );

  }

  private onRestoreProgress(message: RCloneResult): void {
    if(message.type === 'progress'){
      this.taskService.updateTaskInfo(BackupService.RESTORE_BACKUP_TASK, message.data, false);
    }
  }

  private onRestoreBackupError(message: string): void {
    this.taskService.markTaskAsError(BackupService.RESTORE_BACKUP_TASK, `Error during backup restore : ${message}`);
  }

  private onRestoreBackupSuccess(): void {
    this.taskService.markTaskAsSuccess(BackupService.RESTORE_BACKUP_TASK, 'Backup restored successfully');
  }

  private logError(message: string, error: Error): void {
    this.logger.error(message);
    if(error.stack){
      this.logger.error(error.stack);
    }
  }


}

