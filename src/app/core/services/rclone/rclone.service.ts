import { Injectable } from '@nestjs/common';
import { BucketConfig } from '../../models/bucket-config.class';
import { CommandService, SpawnResponse, SpawnResult } from '../command/command.service';
import { filter, map } from 'rxjs';


@Injectable()
export class RcloneService {

  constructor(private commandService: CommandService) {

  }


  public syncFolderToS3(config: BucketConfig, localSourcePath: string, s3DestinationPath: string): SpawnResponse {
    if (!s3DestinationPath.startsWith('/')) s3DestinationPath = '/' + s3DestinationPath
    return this.runRcloneCommand(config, localSourcePath, ':s3:' + config.bucket + s3DestinationPath);
  }

  public syncFolderFromS3(config: BucketConfig, s3SourcePath: string, localDestinationPath: string): SpawnResponse {
    if (!s3SourcePath.startsWith('/')) s3SourcePath = '/' + s3SourcePath
    return this.runRcloneCommand(config, ':s3:' + config.bucket + s3SourcePath, localDestinationPath);
  }

  private runRcloneCommand(config: BucketConfig, source: string, destination: string): SpawnResponse {
    const spanwResult = this.commandService.spawn('rclone',
      [
        '-P',
        '--s3-endpoint', config.endpoint,
        '--s3-region', config.region,
        '--s3-access-key-id', config.credentials.accessKeyId,
        '--s3-secret-access-key', config.credentials.secretAccessKey,
        '--drive-chunk-size', '128M',
        '--transfers', '16',
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