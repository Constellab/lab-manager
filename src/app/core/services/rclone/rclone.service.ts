import { Injectable } from '@nestjs/common';
import { BucketConfig } from '../../models/bucket-config.class';
import { CommandService, SpawnResponse, SpawnResult } from '../command/command.service';
import { filter, map } from 'rxjs';


@Injectable()
export class RcloneService {

  constructor(private commandService: CommandService) {
  }


  public syncFolderToS3(config: BucketConfig, localSourcePath: string, s3DestinationPath: string): SpawnResponse {
    if (!s3DestinationPath.startsWith('/')) s3DestinationPath = '/' + s3DestinationPath;

    const options = this.getOptions(config);
    const bucketName = this.getBucketName(config);
    const bucketType = this.getBucketType(config);

    return this.runSyncRCloneCommand(options, localSourcePath, bucketType + bucketName + s3DestinationPath);
  }

  public syncFolderFromS3(config: BucketConfig, s3SourcePath: string, localDestinationPath: string): SpawnResponse {
    if (!s3SourcePath.startsWith('/')) s3SourcePath = '/' + s3SourcePath

    const options = this.getOptions(config);
    const bucketName = this.getBucketName(config);
    const bucketType = this.getBucketType(config);

    return this.runSyncRCloneCommand(options, bucketType + bucketName + s3SourcePath, localDestinationPath);
  }

  private getOptions(config: BucketConfig): string[] {
    if (config.type === 's3') {
      return [
        '--s3-endpoint', config.config.endpoint,
        '--s3-region', config.config.region,
        '--s3-access-key-id', config.config.credentials.accessKeyId,
        '--s3-secret-access-key', config.config.credentials.secretAccessKey,
      ];
    } else {
      return [
        '--azureblob-account', config.config.accountName,
        '--azureblob-key', config.config.accountKey,
      ];
    }
  }

  private getBucketName(config: BucketConfig): string {
    if (config.type === 's3') {
      return config.config.bucket;
    } else {
      return config.config.containerName;
    }
  }

  public getBucketType(config: BucketConfig): string{
    if (config.type === 's3') {
      return ':s3:';
    }else{
      return ':azureblob:';
    }
  }

  private runSyncRCloneCommand(options: string[], source: string, destination: string): SpawnResponse {
    const spanwResult = this.commandService.spawn('rclone',
      [
        '-P',
        '--drive-chunk-size', '128M',
        '--transfers', '16',
        ...options,
        'sync', source, destination
      ]);

    return {
      childProcess: spanwResult.childProcess,
      observable: spanwResult.observable.pipe(
        // filter useful to only get the progess messages
        filter(data => data.data.startsWith('Transferred') && data.data.includes('%')),
        map(data => this.cleanProgressMessage(data))
      )
    }
  }



  private cleanProgressMessage(result: SpawnResult): SpawnResult {
    // remove the part of the message after text : 'Error'
    const index = result.data.indexOf('Error');
    if (index > 0) {
      return {
        data: result.data.substring(0, index),
        status: result.status
      }
    }

    return result;
  }

}