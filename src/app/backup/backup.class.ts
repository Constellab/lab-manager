import { ChildProcess } from "child_process";
import { BucketConfig } from "../core/models/bucket-config.class";
import { StringHelper } from "../core/helpers/string.helper";


export type BackupFrequency = 'DAILY' | 'WEEKLY';
export type BackupTriggerMode = 'MANUAL' | 'AUTOMATIC';


/**
 * Object sent by central that contains information about the backups location
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


export type BackupType = 'DATA' | 'DB';
export type BackupStatus = 'IN_PROGRESS' | 'SUCCESS' | 'ERROR';

export interface BackupStatusObject {
  status: BackupStatus
  message: string;
}

export interface LabBackupStorageI {
  id: string;
  region: string;
  bucket: string;
  endpoint: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: BackupStatus;
  dataStatus: BackupStatusObject;
  dbStatus: BackupStatusObject;
  dataSize: number;
  dbSize: number;
  frequency: BackupFrequency;
  triggerMode: BackupTriggerMode;
  s3Prefix: string;
}

export class LabBackupStorage {

  // store in the json
  id: string;
  region: string;
  bucket: string;
  endpoint: string;
  startUploadAt: Date;
  endUploadAt?: Date;
  status: BackupStatus;
  dataStatus: BackupStatusObject;
  dbStatus: BackupStatusObject;
  dataSize: number;
  dbSize: number;
  frequency: BackupFrequency;
  triggerMode: BackupTriggerMode;
  s3Prefix: string

  // not stored in the json
  dbProcess: ChildProcess;
  dataProcess: ChildProcess;
  private accessKeyId: string;
  private secretAccessKey: string;

  private static readonly DAY = 24 * 60 * 60 * 1000; // 24h
  private static readonly WEEK = 7 * LabBackupStorage.DAY; // 7 days

  constructor(region: string, bucket: string, endpoint: string, frequency: BackupFrequency,
    triggerMode: BackupTriggerMode, s3Prefix: string) {
    this.id = StringHelper.generateUUID() + '_' + new Date().getTime();
    this.region = region;
    this.bucket = bucket;
    this.endpoint = endpoint;
    this.frequency = frequency;
    this.triggerMode = triggerMode;
    this.s3Prefix = s3Prefix;
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

    // clear the process
    if (status !== 'IN_PROGRESS') {
      if (backupType === 'DATA') {
        this.dataProcess = null;
      } else {
        this.dbProcess = null;
      }
    }
  }

  public isFinished(): boolean {
    return this.status !== 'IN_PROGRESS';
  }

  public setAccessKeys(accessKeyId: string, secretAccessKey: string): void {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  public getBucketConfig(): BucketConfig {
    return {
      bucket: this.bucket,
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,  
        secretAccessKey: this.secretAccessKey,
      }
    };
  }

  public setProcess(backupType: BackupType, process: ChildProcess): void {
    if (backupType === 'DATA') {
      this.dataProcess = process;
    } else {
      this.dbProcess = process;
    }
  }

  /**
   * return true if the backup is expired based on the frequency
   * this means a new backup must be done
   */
  public backupIsExpired(): boolean {
    if(this.endUploadAt == null) return false;

    if (this.frequency === 'DAILY') {
      return (new Date().getTime() - this.endUploadAt.getTime()) > LabBackupStorage.DAY;
    } else {
      return (new Date().getTime() - this.endUploadAt.getTime()) > LabBackupStorage.WEEK;
    }
  }


  public static fromJson(json: LabBackupStorageI): LabBackupStorage {
    const storage = new LabBackupStorage(json.region, json.bucket, json.endpoint, json.frequency,
      json.triggerMode, json.s3Prefix);
    storage.id = json.id;
    storage.startUploadAt = new Date(json.startUploadAt);
    storage.endUploadAt = json.endUploadAt ? new Date(json.endUploadAt) : null;
    storage.status = json.status;
    storage.dataStatus = json.dataStatus;
    storage.dbStatus = json.dbStatus;
    storage.dataSize = json.dataSize;
    storage.dbSize = json.dbSize;
    return storage;
  }

  public toJson(): LabBackupStorageI {
    return {
      id: this.id,
      region: this.region,
      bucket: this.bucket,
      endpoint: this.endpoint,
      startUploadAt: this.startUploadAt,
      endUploadAt: this.endUploadAt,
      status: this.status,
      dataStatus: this.dataStatus,
      dbStatus: this.dbStatus,
      dataSize: this.dataSize,
      dbSize: this.dbSize,
      frequency: this.frequency,
      triggerMode: this.triggerMode,
      s3Prefix: this.s3Prefix,
    }
  }
}
