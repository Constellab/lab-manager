export enum BucketType {
  NORMAL = 'NORMAL',
  AZURE = 'AZURE', // azure blob storage
  GCP = 'GCP', // gcp bucket
}

export type BucketConfig =
  | {
      type: BucketType.NORMAL | BucketType.GCP;
      config: S3BucketConfig;
    }
  | {
      type: BucketType.AZURE;
      config: AzureContainerConfig;
    };

export interface AzureContainerConfig {
  accountName: string;
  containerName: string;
  accountKey: string;
  region: string;
}

export interface S3BucketConfig {
  endpoint: string;
  region: string;
  bucket: string;
  credentials: ObjectStorageCredentials;
}

export interface ObjectStorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}
