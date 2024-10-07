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

  public testRclone(): RCloneRespsonse {
    const obs = this.runSyncRCloneCommand([
      // '--dry-run',
      '--s3-endpoint', 'https://s3.gra.io.cloud.ovh.net/',
      '--s3-region', 'gra', '--s3-access-key-id', 'ce7e6d93a1f6400fb4c19b3aebaf2547', 
      '--s3-secret-access-key', '04c55d337299410c9858043ede58b717', 
      '--use-json-log', 
      '-P',
      '--stats', '2s', 
      '--stats-log-level', 'NOTICE', 
      '--stats-one-line', 
      '--stats-unit=bytes',
    ], 
    '/home/lab-manager/.vscode', 
    // '/home/lab-manager/node_modules', 
    ':s3:constellab-lab-bakcup-pre-prod-gra/test'
    );

    obs.observable.subscribe({
      next: data => console.log(data),
      error: error => console.error('ERRRROROOOR ', error),
    });
    return obs;
  }

  private runSyncRCloneCommand(options: string[], source: string, destination: string): RCloneRespsonse {
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
        map(data => this.convertRcloneLogs(data))
      )
    }
  }

  private convertRcloneLogs(data: SpawnResult): RCloneResult {
    // catch the last status message
    // it is marked as error and is a json object
    // data: '{"level":"warning","msg":"         0 / 0 Bytes, -, 0 Bytes/s, 
    // ETA -\\n","source":"accounting/stats.go:355",
    // "stats":{"bytes":0,"checks":4,"deletes":0,"elapsedTime":0.320786925,"errors":0,"fatalError":false,"renames":0,"retryError":false,"speed":0,
    // "transferTime":0.094387746,"transfers":0},"time":"2024-10-07T10:43:06.979148+00:00"}\n'
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