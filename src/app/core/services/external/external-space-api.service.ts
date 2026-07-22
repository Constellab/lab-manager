import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { LabBackupHistory } from '../../../backup/backup-history.class';
import { BackupInfoDTO } from '../../../backup/backup.class';
import { ApiHttpOption } from '../api/api.class';
import { ApiService } from '../api/api.service';
import { CoreConfigService } from '../config/core-config.service';
import { FileService } from '../file/file.service';
import { LabManagerMigrationPlanDTO } from '../../../lab/init/migration/migration.dto';
import { UpdateLabManagerCommand } from './external-space.class';

/**
 * Class to call route of space using space api
 */
@Injectable()
export class ExternalSpaceApiService {
  private static readonly API_KEY_HEADER = 'Authorization';
  private static readonly API_KEY_SCHEMA = 'api-key';
  private static readonly LAB_MANAGER_VERSION = 'lab-manager-version';

  private static readonly BASE_API_ROUTE = 'external-labs-manager';

  private readonly logger = new Logger(ExternalSpaceApiService.name);

  constructor(
    private apiService: ApiService,
    private fileService: FileService,
    private configService: CoreConfigService
  ) {}

  public getBackupInfo(): Promise<BackupInfoDTO> {
    return lastValueFrom(
      this.apiService.get(this.constructRoute('lab/backup-info-v2'), this.getRequestOptions())
    );
  }

  public syncBackupHistory(backupHistory: LabBackupHistory): Promise<void> {
    return lastValueFrom(
      this.apiService.post(
        this.constructRoute('lab/backup-history-v2'),
        backupHistory.toJson(),
        this.getRequestOptions()
      )
    );
  }

  public getUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    return lastValueFrom(
      this.apiService.get(this.constructRoute('desktop/update-lab-manager-command'), this.getRequestOptions())
    ).catch((err) => {
      this.logger.error('Error while getting the update lab manager command', err);
      throw new BadRequestException('Error while getting the update lab manager command');
    });
  }

  public getVersionUpgradeInfo(): Promise<LabManagerMigrationPlanDTO> {
    const version = this.configService.getLabManagerVersion();
    return lastValueFrom(this.apiService.get(this.constructRoute(`version-upgrade-info/${version}`))).catch(
      (err) => {
        this.logger.error('Error while getting the version upgrade info', err);
        throw new BadRequestException('Error while getting the version upgrade info');
      }
    );
  }

  ////////////////// METHODS TO BUILD THE REQUEST //////////////////

  private constructRoute(route: string): string {
    const isDev = this.configService.isDevelopment();
    let url: string;
    if (isDev) {
      url = 'http://host.docker.internal:3001';
    } else {
      const privateFile = this.fileService.readPrivateFile();
      url = privateFile.space.apiUrl;
    }

    return `${url}/${ExternalSpaceApiService.BASE_API_ROUTE}/${route}`;
  }

  // get the axios request config with the api key in the header
  private getRequestOptions(options: ApiHttpOption = {}): ApiHttpOption {
    const apiKey = this.configService.getLabManagerApiKey();

    return Object.assign(options, { headers: this.getHeader(apiKey) });
  }

  // get the header with api key
  private getHeader(apiKey: string): any {
    const header: any = {};
    header[ExternalSpaceApiService.API_KEY_HEADER] = `${ExternalSpaceApiService.API_KEY_SCHEMA} ${apiKey}`;
    // add the lab manager version in the header
    header[ExternalSpaceApiService.LAB_MANAGER_VERSION] = this.configService.getLabManagerVersion();
    return header;
  }
}
