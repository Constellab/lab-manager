import {Injectable, Logger} from '@nestjs/common';
import {CommandService} from '../command/command.service';
import {FileService} from '../file/file.service';
import {CoreConfigService} from '../config/core-config.service';

@Injectable()
export class BiotaService {

  private readonly pullBiotaScript = 'pull_biota.sh';

  private readonly logger = new Logger(BiotaService.name);

  constructor(private commandService: CommandService,
    private fileService: FileService,
    private configService: CoreConfigService) {
  }

  public async pullBiota(): Promise<void> {
    const file = this.fileService.getAssetPath(this.pullBiotaScript);

    try {
      await this.commandService.execFile(file, [this.configService.getAppFolder()]);
    } catch (e: any) {
      this.logger.error('Error during the biota pull. Error : ' + e);
      throw e;
    }
  }
}
