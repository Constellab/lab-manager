import { Injectable } from '@nestjs/common';
import { BucketConfig } from '../../models/bucket-config.class';
import { CommandService, SpawnResult } from '../command/command.service';
import { map } from 'rxjs';
import { RCloneRespsonse, RCloneResult } from './rclone.class';


@Injectable()
export class RcloneService {

  constructor(private commandService: CommandService) {
  }


  public syncFolderToS3(config: BucketConfig, localSourcePath: string, s3DestinationPath: string): RCloneRespsonse {
    if (!s3DestinationPath.startsWith('/')) s3DestinationPath = '/' + s3DestinationPath;

    const options = this.getOptions(config);
    const bucketName = this.getBucketName(config);
    const bucketType = this.getBucketType(config);

    return this.runSyncRCloneCommand(options, localSourcePath, bucketType + bucketName + s3DestinationPath);
  }

  public syncFolderFromS3(config: BucketConfig, s3SourcePath: string, localDestinationPath: string): RCloneRespsonse {
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

  private runSyncRCloneCommand(options: string[], source: string, destination: string): RCloneRespsonse {
    const spanwResult = this.commandService.spawn('rclone',
      [
        '-P',
        '--stats', '5s', // update log every 5 seconds
        '--stats-one-line', // only log important stats
        '--use-json-log',  // enable last stats logs as json
        '--stats-log-level', 'NOTICE',  // enable last stats logs
        '--drive-chunk-size', '128M',
        '--transfers', '16',
        ...options,
        'sync', source, destination
      ]);

    return {
      childProcess: spanwResult.childProcess,
      observable: spanwResult.observable.pipe(
        map(data => this.convertRcloneLogs(data))
      )
    }
  }

  private convertRcloneLogs(data: SpawnResult): RCloneResult {
    // catch the last status message
    // it is marked as error and is a json object
    if(data.status === 'error' && this.stringIsFinalStatsJson(data.data) ){
      const lines = data.data.split('\n');
      for(const line of lines){
        if(this.stringIsFinalStatsJson(line)){
          return {
            type: 'finalStats',
            data: JSON.parse(line)
          }
        }
      }
    }

    return {
      type: data.status === 'error' ? 'error' : 'progress',
      data: data.data
    };
  }

  private stringIsFinalStatsJson(data: string): boolean {
    return data.startsWith('{')
      && data.includes('"stats"')  && data.includes('"checks"')   
    && data.includes('"deletes"')   && data.includes('"bytes"');
  }

}