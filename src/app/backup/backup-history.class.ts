import { BackupBucketDTO, BackupFrequency, BackupInfoDTO, LabBackupStorage } from "./backup.class";

export class LabBackupHistory {
    version: number;
    backups: LabBackupStorage[];

    private static readonly DAY = 24 * 60 * 60 * 1000; // 24h
    private static readonly WEEK = 7 * LabBackupHistory.DAY; // 7 days

    constructor() {
        this.version = 2;
        this.backups = [];
    }

    public static fromJson(json: any): LabBackupHistory {
        const history = new LabBackupHistory();
        history.version = json.version;
        history.backups = json.backups.map((backup: any) => LabBackupStorage.fromJson(backup));
        history.sortBackups();

        return history;
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
    // TODO TO FIX
    public getBackupToTrigger(backupBucketDto: BackupBucketDTO[], forceBackup: boolean): BackupBucketDTO[] {
        const lastBackup = this.getLastBackup();
        if (!lastBackup) {
            return backupBucketDto;
        }

        const lastBackupDate = lastBackup.startUploadAt;
        const now = new Date();

        const diff = now.getTime() - lastBackupDate.getTime();

        if (diff < LabBackupHistory.DAY) {
            // if forceBackup is true, return the daily backup
            if (forceBackup) {
                const daily = backupBucketDto.filter(backup => backup.backupFrequency === 'DAILY');
                if (daily.length > 0) {
                    return daily;
                }
                return backupBucketDto
            }
            return [];
        }

        if (diff < LabBackupHistory.WEEK) {
            return backupBucketDto.filter(backup => backup.backupFrequency === 'DAILY');
        }

        return backupBucketDto.filter(backup => backup.backupFrequency === 'WEEKLY');
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