import { Injectable } from '@nestjs/common';
import { BucketConfig } from '../../models/bucket-config.class';
import { CommandService, SpawnResponse } from '../command/command.service';


@Injectable()
export class RcloneService {

  constructor(private commandService: CommandService) {

  }


  public syncFolder(config: BucketConfig, pathToSync: string, destinationFolder: string = ''): SpawnResponse {
    return this.commandService.spawn('rclone',
      [
        '-P',
        '--s3-endpoint', config.endpoint,
        '--s3-region', config.region,
        '--s3-access-key-id', config.accessKeyId,
        '--s3-secret-access-key', config.secretAccessKey,
        '--drive-chunk-size', '128M',
        '--transfers', '16',
        'sync', pathToSync, 
        ':s3:' + config.bucket + destinationFolder // prefix with :s3: to force s3 backend,
      ]);
  }
}