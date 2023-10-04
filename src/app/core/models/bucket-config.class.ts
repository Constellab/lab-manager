export interface BucketConfig {
  endpoint: string;
  region: string;
  bucket: string;
  credentials: ObjectStorageCredentials;
}

export interface ObjectStorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}