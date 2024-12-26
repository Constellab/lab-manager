export type BucketConfig =
  | {
      type: 's3';
      config: S3BucketConfig;
    }
  | {
      type: 'azureBlob';
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
