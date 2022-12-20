
export interface CreateBackupDto {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  bucket: string;
  endpoint: string;
  region: string;
}


export interface LabBackup {
  status: 'IN_PROGRESS'| 'DONE' | 'ERROR';
  storages: LabBackupStorage[];
  message?: string;
}

export interface LabBackupStorage{
  region: string;
  bucket: string;
  endpoint: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: 'IN_PROGRESS'| 'DONE' | 'ERROR';
  message?: string;
}

export interface LabBackupHistory{
  version: number;
  backups: LabBackup[];
}