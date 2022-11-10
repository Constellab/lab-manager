import {Injectable} from '@nestjs/common';
import {DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {IncomingMessage} from 'http';
import {StringHelper} from '../../helpers/string.helper';
import {createReadStream, ReadStream} from 'fs';

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
}

/**
 * Service to communicate with an object storage s3 to store files.
 */
@Injectable()
export class ObjectStorageService {

  constructor() {
  }

  public generateRandomFileName(extension: string): string {
    return StringHelper.generateUUID() + '_' + new Date().getTime() + '.' + extension;
  }

  public async uploadFileFromPath(config: ObjectStorageConfig, filePath: string): Promise<string> {
    const filename = this.generateRandomFileName(StringHelper.getFileExtension(filePath));

    const fileStream = createReadStream(filePath);
    return await this.uploadObject(config, fileStream, filename);
  }

  public async uploadObject(config: ObjectStorageConfig, obj: ReadStream, filename: string): Promise<string> {
    const s3Client = this.getClient(config);

    await s3Client.send(new PutObjectCommand({
      Bucket: config.bucket, Key: filename, Body: obj
    }));

    return filename;
  }

  public async getObject(config: ObjectStorageConfig, objectName: string): Promise<IncomingMessage> {
    const s3Client = this.getClient(config);

    const result = await s3Client.send(new GetObjectCommand({Bucket: config.bucket, Key: objectName}));
    return result.Body as any;
  }

  public async deleteObject(config: ObjectStorageConfig, objectName: string): Promise<void> {
    const s3Client = this.getClient(config);

    await s3Client.send(new DeleteObjectCommand({Bucket: config.bucket, Key: objectName}));
  }

  private getClient(config: ObjectStorageConfig): S3Client {
    return new S3Client({endpoint: config.endpoint, region: config.region});
  }
}
