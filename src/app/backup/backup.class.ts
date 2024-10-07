import { ChildProcess } from "child_process";
import { BucketConfig } from "../core/models/bucket-config.class";
import { StringHelper } from "../core/helpers/string.helper";
import { RCloneFinalStatsDetail } from "../core/services/rclone/rclone.class";


export type BackupFrequency = 'DAILY' | 'WEEKLY';
export type BackupTriggerMode = 'MANUAL' | 'AUTOMATIC';


/**
 * Object sent by space that contains information about the backups location
 */
export interface BackupInfoDTO {
  version: number;
  backupBuckets: BackupBucketDTO[];
  s3Prefix: string;
}

export interface BackupBucketDTO {
  backupFrequency: BackupFrequency;
  bucketConfig: BucketConfig;
}

export interface BackupRestoreOptionsDTO {
  restoreDb: boolean;
  restoreData: boolean;
  force: boolean;
}

export interface BackupRestoreDTO {
  version: number;
  bucketConfig: BucketConfig;
  s3Prefix: string;
  options: BackupRestoreOptionsDTO;
}


export type BackupType = 'DATA' | 'DB';
export type BackupStatus = 'IN_PROGRESS' | 'SUCCESS' | 'ERROR';

export interface BackupStatusObject {
  status: BackupStatus
  message: string;
}

export interface BackupInfo {
  status: BackupStatusObject;
  totalSize: number;
  transfer?: RCloneFinalStatsDetail;
}


export interface LabBackupStorageI {
  id: string;
  type: 's3' | 'azureBlob';
  region: string;
  bucket: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: BackupStatus;

  data: BackupInfo;
  db: BackupInfo;

  frequency: BackupFrequency;
  triggerMode: BackupTriggerMode;
  s3Prefix: string;

  endpoint: string; // for s3
  accountName: string; // for azure
}


export class LabBackupStorage {
  // store in the json
  id: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: BackupStatus;

  data: BackupInfo;
  db: BackupInfo;

  frequency: BackupFrequency;
  triggerMode: BackupTriggerMode;
  s3Prefix: string;
  
  // not stored in the json
  bucketConfig: BucketConfig;
  dbProcess: ChildProcess;
  dataProcess: ChildProcess;

  constructor(triggerMode: BackupTriggerMode, s3Prefix: string) {
    this.id = StringHelper.generateUUID() + '_' + new Date().getTime();
    this.triggerMode = triggerMode;
    this.s3Prefix = s3Prefix;
    this.status = 'IN_PROGRESS';
    this.startUploadAt = new Date();
    this.data = {
      totalSize: 0,
      status:{
        message: 'Backup started',
        status: 'IN_PROGRESS',
      }
    };
    
    this.data = {
      totalSize: 0,
      status:{ 
        message: 'Backup started',
        status: 'IN_PROGRESS',
      }
    };
  }
  
  public setBackupBucketDto(backupBucketDto: BackupBucketDTO): void {
    this.frequency = backupBucketDto.backupFrequency;
    this.bucketConfig = backupBucketDto.bucketConfig;
  }

  public setDataTotalSize(size: number): void {
    this.data.totalSize = size;
  }

  public setDbTotalSize(size: number): void {
    this.db.totalSize = size;
  }

  public getDataStatus(): BackupStatus {
    return this.data.status.status;
  }

  public getDbStatus(): BackupStatus {
    return this.db.status.status;
  }

  public setStats(backupType: BackupType, transfer: RCloneFinalStatsDetail): void {
    if(backupType === "DATA"){      
      this.data.transfer = transfer;
    }else{
      this.db.transfer = transfer;
    }
  }


  public updateMessage(backupType: BackupType, status: BackupStatus, message: string): void {
    const backupStatus: BackupStatusObject = {
      message,
      status,
    }

    if (backupType === 'DATA') {
      this.data.status = backupStatus
    } else {
      this.db.status = backupStatus
    }

    // if both are done, set the endUploadAt
    if (this.data.status.status !== 'IN_PROGRESS' && this.db.status.status !== 'IN_PROGRESS') {
      // if one of the two is in error, set the status to error
      this.status = this.data.status.status === 'ERROR' || this.db.status.status === 'ERROR' ? 'ERROR' : 'SUCCESS';
      this.endUploadAt = new Date();
    }

    // clear the process
    if (status !== 'IN_PROGRESS') {
      if (backupType === 'DATA') {
        this.dataProcess = null;
      } else {
        this.dbProcess = null;
      }
    }
  }

  public getRegion(): string {
    return this.bucketConfig.config.region;
  }

  public getBucketName(): string {
    return this.bucketConfig.type === 's3' ? this.bucketConfig.config.bucket : this.bucketConfig.config.containerName;
  }

  public isFinished(): boolean {
    return this.status !== 'IN_PROGRESS';
  }

  public getBucketConfig(): BucketConfig {
    return this.bucketConfig;
  }

  public setProcess(backupType: BackupType, process: ChildProcess): void {
    if (backupType === 'DATA') {
      this.dataProcess = process;
    } else {
      this.dbProcess = process;
    }
  }

  public static fromJson(json: LabBackupStorageI): LabBackupStorage {
    const storage = new LabBackupStorage(json.triggerMode, json.s3Prefix);
    storage.id = json.id;
    if(json.type === 's3' || !json.type) {
      storage.bucketConfig = {
        type: 's3',
        config: {
          bucket: json.bucket,
          endpoint: json.endpoint,
          region: json.region,
          credentials: null
        }
      }
    }else{
      storage.bucketConfig = {
        type: 'azureBlob',
        config: {
          accountName: json.accountName,
          containerName: json.bucket,
          accountKey: '',
          region: json.region
        }
      }
    }
    storage.startUploadAt = new Date(json.startUploadAt);
    storage.endUploadAt = json.endUploadAt ? new Date(json.endUploadAt) : null;
    storage.status = json.status;
    storage.data = json.data;
    storage.db = json.db;
    return storage;
  }

  public toJson(): LabBackupStorageI {
    return {
      id: this.id,
      type: this.bucketConfig.type,
      startUploadAt: this.startUploadAt,
      endUploadAt: this.endUploadAt,
      status: this.status,
      data: this.data,
      db: this.db,
      frequency: this.frequency,
      triggerMode: this.triggerMode,
      s3Prefix: this.s3Prefix,
      region: this.getRegion(),
      bucket: this.getBucketName(),
      endpoint: this.bucketConfig.type === 's3' ? this.bucketConfig.config.endpoint : null,
      accountName: this.bucketConfig.type === 's3' ? null : this.bucketConfig.config.accountName
    }
  }
}
