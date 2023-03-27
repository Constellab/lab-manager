
export interface CreateBackupDto {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  bucket: string;
  endpoint: string;
  region: string;
}

export type BackupType = 'DATA' | 'DB';
export type BackupStatus = 'IN_PROGRESS' | 'SUCCESS' | 'ERROR';

export interface BackupStatusObject {
  status: BackupStatus
  message: string;
}

export class LabBackup {
  status: BackupStatus;
  storages: LabBackupStorage[];

  constructor() {
    this.status = 'IN_PROGRESS';
    this.storages = [];
  }

  public updateMessage(backupType: BackupType, status: BackupStatus, message: string): void {
    this.storages[0].updateMessage(backupType, status, message);

    if (this.storages[0].isFinished()){
      this.status = this.storages[0].status;
    }
  }

  public addStorage(storage: LabBackupStorage): void {
    this.storages.push(storage);
  }

  public isFinished(): boolean {
    return this.status !== 'IN_PROGRESS';
  }
}

export class LabBackupStorage {
  region: string;
  bucket: string;
  endpoint: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: BackupStatus;
  dataStatus: BackupStatusObject;
  dbStatus: BackupStatusObject;

  constructor(region: string, bucket: string, endpoint: string) {
    this.region = region;
    this.bucket = bucket;
    this.endpoint = endpoint;
    this.status = 'IN_PROGRESS';
    this.startUploadAt = new Date();
    this.dataStatus = {
      message: 'Backup started',
      status: 'IN_PROGRESS',
    };

    this.dbStatus = {
      message: 'Backup started',
      status: 'IN_PROGRESS',
    };
  }


  public updateMessage(backupType: BackupType, status: BackupStatus, message: string): void {
    const backupStatus: BackupStatusObject = {
      message,
      status,
    }

    if (backupType === 'DATA') {
      this.dataStatus = backupStatus
    } else {
      this.dbStatus = backupStatus
    }

    // if both are done, set the endUploadAt
    if (this.dataStatus.status !== 'IN_PROGRESS' && this.dbStatus.status !== 'IN_PROGRESS') {
      // if one of the two is in error, set the status to error
      this.status = this.dataStatus.status === 'ERROR' || this.dbStatus.status === 'ERROR' ? 'ERROR' : 'SUCCESS';
      this.endUploadAt = new Date();
    }
  }

  public isFinished(): boolean {
    return this.status !== 'IN_PROGRESS';
  }

}

export class LabBackupHistory {
  version: number;
  backups: LabBackup[];
}