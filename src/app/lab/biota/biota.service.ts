import {Injectable, Logger} from '@nestjs/common';
import {CommandService} from '../../core/services/command/command.service';
import {FileService} from '../../core/services/file/file.service';
import {CoreConfigService} from '../../core/services/config/core-config.service';
import {TaskService} from '../../core/services/task/task.service';
import {EnvVariableService} from '../env-variable/env-variable.service';
import {ConfigFileService} from '../config-file/config-file.service';

@Injectable()
export class BiotaService {

  private readonly pullBiotaScript = 'pull_biota.sh';

  private readonly logger = new Logger(BiotaService.name);


  constructor(private commandService: CommandService,
    private fileService: FileService,
    private configService: CoreConfigService,
    private configFileService: ConfigFileService,
    private taskService: TaskService,
    private envVariableService: EnvVariableService) {
  }

  public async pullBiota(setEnvVariable: boolean = true): Promise<void> {
    if (setEnvVariable) {
      await this.envVariableService.setEnvVariables();
    }

    const file = this.fileService.getAssetPath(this.pullBiotaScript);
    const destination = this.configService.getBiotaDbFolder();

    const taskName = 'PULL_BIOTA_DB';
    const config = this.configFileService.readConfigFile();
    this.taskService.newTask(taskName, `Pulling biota db from ${config.biota_maria_db_url} into ${destination}`);

    try {
      await this.commandService.execCommand(`bash ${file} ${destination} ${config.biota_maria_db_url}`);
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
