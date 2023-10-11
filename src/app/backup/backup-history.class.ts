import { BackupFrequency, LabBackupStorage } from "./backup.class";

export class LabBackupHistory {
    version: number;
    backups: LabBackupStorage[];

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