import { Injectable } from '@nestjs/common';
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { IncomingMessage } from 'http';
import { StringHelper } from '../../helpers/string.helper';
import { ReadStream } from 'fs';
import { BucketConfig } from '../../models/bucket-config.class';


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

  // public async uploadFileFromPath(config: BucketConfig, filePath: string): Promise<string> {
  //   const filename = this.generateRandomFileName(StringHelper.getFileExtension(filePath));

  //   const s3Client = this.getClient(config);
    

  //   try {
  //     const parallelUploads3 = new Upload({
  //       client: s3Client,
  //       queueSize: 4, // optional concurrency configuration
  //       partSize: 1024 * 1024 * 10, // optional size of each part
  //       leavePartsOnError: false, // optional manually handle dropped parts
  //       params: { Bucket: 'my-new-bucket', Key: filename, Body: createReadStream(filePath) },
  //     });

  //     parallelUploads3.on("httpUploadProgress", (progress) => {
  //       console.log(progress);
  //     });

  //     await parallelUploads3.done();
  //   } catch (e) {
  //     console.log(e);
  //     throw new BadRequestException('Error while uploading file : ' + e);
  //   }

  //   return filename;

  // }

  public async createBucket(config: BucketConfig): Promise<void> {
    const s3Client = this.getClient(config);

    await s3Client.send(new CreateBucketCommand({ Bucket: 'new-bucket-auto' }));
  }

  public async uploadObject(config: BucketConfig, obj: ReadStream, filename: string): Promise<string> {
    const s3Client = this.getClient(config);

    await s3Client.send(new PutObjectCommand({
      Bucket: config.bucket, Key: filename, Body: obj,
    }));

    return filename;
  }

  public async getObject(config: BucketConfig, objectName: string): Promise<IncomingMessage> {
    const s3Client = this.getClient(config);

    const result = await s3Client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectName }));
    return result.Body as any;
  }

  public async deleteObject(config: BucketConfig, objectName: string): Promise<void> {
    const s3Client = this.getClient(config);

    await s3Client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectName }));
  }

  private getClient(config: BucketConfig): S3Client {
    return new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
      }
    });
  }
}
