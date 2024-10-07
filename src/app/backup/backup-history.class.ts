import { BackupBucketDTO, BackupFrequency, BackupInfo, LabBackupStorage } from "./backup.class";

export class LabBackupHistory {

  private static readonly CURRENT_VERSION = 3;
  version: number;
  backups: LabBackupStorage[];

  private static readonly DAY = 24 * 60 * 60 * 1000; // 24h
  private static readonly WEEK = 7 * LabBackupHistory.DAY; // 7 days
  private static readonly ONE_MINUTE = 60 * 1000; // 1 minute

  constructor() {
    this.version = LabBackupHistory.CURRENT_VERSION;
    this.backups = [];
  }

  public static fromJson(json: any): LabBackupHistory {

    if(json.version === 2){
      json = this.migrateFrom2To3(json);
    }

    const history = new LabBackupHistory();

    history.backups = json.backups.map((backup: any) => LabBackupStorage.fromJson(backup));
    history.sortBackups();

    return history;
  }

  public static migrateFrom2To3(json: any): any {
    for(const backup of json.backups){
      if(!backup.data){
        backup.data = {
          totalSize: backup.dataSize,
          status: backup.dataStatus,
          transfer: null,
        } as BackupInfo;
        delete backup.dataSize;
        delete backup.dataStatus;
      }
      if(!backup.db){
        backup.db = {
          totalSize: backup.dbSize,
          status: backup.dbStatus,
          transfer: null,
        } as BackupInfo;
        delete backup.dbSize;
        delete backup.dbStatus;
      }

    }
    json.version = LabBackupHistory.CURRENT_VERSION;
    return json;
  }

  /**
     * Base on a list of backupBucketDto, return the backup to trigger
     * Work for daily and weekly backup, it return only one type of backup to trigger
     * If there is no backup inhistory, return daily and weekly backup
     * If the last backup is earlier than 1 day, don't trigger backup
     * If the last backup is older than 1 day and last weekly backup is older than 7 days, trigger weekly backup
     * If the last backup is older than 1 day and last weekly backup is less than 7 days, trigger daily backup
     * @param backupBucketDto 
     * @param forceBackup if true, it will trigger the backup even if the last backup is less than 1 day
     */
  public getBackupToTrigger(backupBucketDto: BackupBucketDTO[], forceBackup: boolean): BackupBucketDTO[] {
    const lastBackup = this.getLastBackup();
    const lastWeeklyBackup = this.getLastBackupByFrequency('WEEKLY');
    if (!lastBackup || !lastWeeklyBackup) {
      return backupBucketDto;
    }

    const now = new Date();

    // diff in milliseconds (add 1 minute to avoid the case when the last backup is just a few seconds ago the last day)
    // diff between now and last backup
    const lastDiff = now.getTime() - lastBackup.startUploadAt.getTime() + LabBackupHistory.ONE_MINUTE;

    // diff between now and last weekly backup
    const lastWeeklyDiff = now.getTime() - lastWeeklyBackup.startUploadAt.getTime() + LabBackupHistory.ONE_MINUTE;

    // if the last backup is less than 1 day, don't trigger backup
    if (lastDiff < LabBackupHistory.DAY) {
      if (forceBackup) {
        return backupBucketDto.filter(backup => backup.backupFrequency === 'DAILY');
      }
      return [];
    }


    // if the last backup is older than 1 day and last weekly backup is older than 7 days, trigger weekly backup
    if (lastDiff >= LabBackupHistory.DAY && lastWeeklyDiff >= LabBackupHistory.WEEK) {
      return backupBucketDto.filter(backup => backup.backupFrequency === 'WEEKLY');
    }

    // if the last backup is older than 1 day and last weekly backup is less than 7 days, trigger daily backup
    return backupBucketDto.filter(backup => backup.backupFrequency === 'DAILY');
  }

  public getLastBackup(): LabBackupStorage | null {
    if (this.backups.length > 0) {
      return this.backups[this.backups.length - 1];
    }
    return null;
  }

  public getLastBackupByFrequency(frequency: BackupFrequency): LabBackupStorage | null {
    if (this.backups.length > 0) {
      const backups = this.backups.filter(backup => backup.frequency === frequency);
      if (backups.length > 0) {
        return backups[backups.length - 1];
      }
    }
    return null;
  }

  /**
     * 
     * @returns the last backup for each frequency
     */
  public getLastBackupsForEachFrequency(): LabBackupStorage[] {
    const backup: LabBackupStorage[] = [];

    const lastDailyBackup = this.getLastBackupByFrequency('DAILY');
    if (lastDailyBackup) backup.push(lastDailyBackup);

    const lastWeeklyBackup = this.getLastBackupByFrequency('WEEKLY');
    if (lastWeeklyBackup) backup.push(lastWeeklyBackup);

    return backup;
  }

  public toJson(): any {
    return {
      version: this.version,
      backups: this.backups.map(backup => backup.toJson()),
    }
  }

  public updateBackup(backup: LabBackupStorage): void {
    const index = this.backups.findIndex(b => b.id === backup.id);
    if (index !== -1) {
      this.backups[index] = backup;
    } else {
      this.backups.push(backup);
    }

    this.sortBackups();
  }

  // sort backups by startUploadAt
  private sortBackups(): void {
    this.backups = this.backups.sort((a, b) => a.startUploadAt.getTime() - b.startUploadAt.getTime());
  }

  public hasRunningBackup(): boolean {
    return this.getRunningBackups().length > 0;
  }

  public getRunningBackups(): LabBackupStorage[] {
    return this.backups.filter(backup => backup.status === 'IN_PROGRESS');
  }

 

}