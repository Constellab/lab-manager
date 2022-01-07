import {Injectable, Logger} from '@nestjs/common';
import {CommandService} from '../command/command.service';
import {FileService} from '../file/file.service';
import {CoreConfigService} from '../config/core-config.service';
import {TaskService} from '../task/task.service';
import {EnvVariableService} from '../env-variable/env-variable.service';

@Injectable()
export class BiotaService {

  private readonly pullBiotaScript = 'pull_biota.sh';

  private readonly logger = new Logger(BiotaService.name);


  constructor(private commandService: CommandService,
    private fileService: FileService,
    private configService: CoreConfigService,
    private taskService: TaskService,
    private envVariableService: EnvVariableService) {
  }

  public async pullBiota(setEnvVariable: boolean = true): Promise<void> {
    if (setEnvVariable) {
      await this.envVariableService.setEnvVariables();
    }

    const file = this.fileService.getAssetPath(this.pullBiotaScript);
    const destination = this.configService.getAppFolder();

    const taskName = 'PULL_BIOTA_DB';
    this.taskService.newTask(taskName);

    try {
      await this.commandService.execCommand(`bash ${file} ${destination}`);
      this.taskService.markTaskAsSuccess(taskName);
    } catch (e: any) {
      this.taskService.markTaskAsError(taskName, 'Error during the biota pull. Error : ' + e);
      if (e.stack) {
        this.logger.error(e.stack);
      }
      throw e;
    }
  }
}
