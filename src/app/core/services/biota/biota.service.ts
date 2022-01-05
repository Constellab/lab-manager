import {Injectable, Logger} from '@nestjs/common';
import {CommandService} from '../command/command.service';
import {FileService} from '../file/file.service';
import {CoreConfigService} from '../config/core-config.service';
import {TaskService} from '../task/task.service';

@Injectable()
export class BiotaService {

  private readonly pullBiotaScript = 'pull_biota.sh';

  private readonly logger = new Logger(BiotaService.name);


  constructor(private commandService: CommandService,
    private fileService: FileService,
    private configService: CoreConfigService,
    private taskService: TaskService) {
  }

  public async pullBiota(): Promise<void> {
    const file = this.fileService.getAssetPath(this.pullBiotaScript);

    const taskName = 'PULL_BIOTA_DB';
    this.taskService.newTask(taskName);

    try {
      await this.commandService.execFile(file, [this.configService.getAppFolder()]);
      this.taskService.markTaskAsSuccess(taskName);
    } catch (e: any) {
      this.taskService.markTaskAsError(taskName, 'Error during the biota pull. Error : ' + e);
      if (e.stack) {
        this.logger.error(e.stack)
      }
      throw e;
    }
  }
}
