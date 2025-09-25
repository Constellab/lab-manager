import { Injectable } from '@nestjs/common';
import { map } from 'rxjs';
import { BucketConfig, BucketType } from '../../models/bucket-config.class';
import { Command, SpawnResult } from '../../utils/command';
import { RCloneRespsonse, RCloneResult } from './rclone.class';

@Injectable()
export class RcloneService {
  constructor() {}

  public syncFolderToS3(
    config: BucketConfig,
    localSourcePath: string,
    s3DestinationPath: string
  ): RCloneRespsonse {
    if (!s3DestinationPath.startsWith('/')) s3DestinationPath = '/' + s3DestinationPath;

    const options = this.getOptions(config);
    const bucketName = this.getBucketName(config);
    const bucketType = this.getBucketType(config);

    return this.runSyncRCloneCommand(options, localSourcePath, bucketType + bucketName + s3DestinationPath);
  }

  public syncFolderFromS3(
    config: BucketConfig,
    s3SourcePath: string,
    localDestinationPath: string
  ): RCloneRespsonse {
    if (!s3SourcePath.startsWith('/')) s3SourcePath = '/' + s3SourcePath;

    const options = this.getOptions(config);
    const bucketName = this.getBucketName(config);
    const bucketType = this.getBucketType(config);

    return this.runSyncRCloneCommand(options, bucketType + bucketName + s3SourcePath, localDestinationPath);
  }

  private getOptions(config: BucketConfig): string[] {
    if (config.type === BucketType.AZURE) {
      return ['--azureblob-account', config.config.accountName, '--azureblob-key', config.config.accountKey];
    } else {
      return [
        '--s3-endpoint',
        config.config.endpoint,
        '--s3-region',
        config.config.region,
        '--s3-access-key-id',
        config.config.credentials.accessKeyId,
        '--s3-secret-access-key',
        config.config.credentials.secretAccessKey,
      ];
    }
  }

  private getBucketName(config: BucketConfig): string {
    if (config.type === BucketType.AZURE) {
      return config.config.containerName;
    } else {
      return config.config.bucket;
    }
  }

  public getBucketType(config: BucketConfig): string {
    if (config.type === BucketType.AZURE) {
      return ':azureblob:';
    } else {
      return ':s3:';
    }
  }

  private runSyncRCloneCommand(options: string[], source: string, destination: string): RCloneRespsonse {
    const spanwResult = new Command().spawn('rclone', [
      '-P',
      '--stats',
      '5s', // update log every 5 seconds
      '--stats-one-line', // only log important stats
      '--use-json-log', // enable last stats logs as json
      '--stats-log-level',
      'NOTICE', // enable last stats logs
      '--drive-chunk-size',
      '128M',
      '--transfers',
      '16',
      ...options,
      'sync',
      source,
      destination,
    ]);

    return {
      childProcess: spanwResult.childProcess,
      observable: spanwResult.observable.pipe(map((data) => this.convertRcloneLogs(data))),
    };
  }

  private convertRcloneLogs(data: SpawnResult): RCloneResult {
    // catch the last status message
    // it is marked as error and is a json object
    if (data.status === 'error' && this.stringIsFinalStatsJson(data.data)) {
      const lines = data.data.split('\n');
      for (const line of lines) {
        if (this.stringIsFinalStatsJson(line)) {
          return {
            type: 'finalStats',
            data: JSON.parse(line),
          };
        }
      }
    }

    return {
      type: data.status === 'error' ? 'error' : 'progress',
      data: data.data,
    };
  }

  private stringIsFinalStatsJson(data: string): boolean {
    return (
      data.startsWith('{') &&
      data.includes('"stats"') &&
      data.includes('"checks"') &&
      data.includes('"deletes"') &&
      data.includes('"bytes"')
    );
  }
}
