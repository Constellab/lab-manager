import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { ApiService } from 'src/app/core/services/api/api.service';
import { ApiHttpOption } from 'src/app/core/services/api/api.class';
import { FileService } from 'src/app/core/services/file/file.service';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { BackupInfoDTO } from 'src/app/backup/backup.class';
import { LabBackupHistory } from 'src/app/backup/backup-history.class';
import { LabManagerRecommendedVersion, UpdateLabManagerCommand } from './external-space.class';

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

  public getLabManagerRecommendedVersion(): Promise<LabManagerRecommendedVersion> {
    return lastValueFrom(this.apiService.get(this.constructRoute('recommended-version'))).catch((err) => {
      this.logger.error('Error while getting the recommended version', err);
      throw new BadRequestException('Error while getting the recommended version of lab manager');
    });
  }

  public getUpdateLabManagerCommand(): Promise<UpdateLabManagerCommand> {
    return lastValueFrom(
      this.apiService.get(this.constructRoute('desktop/update-lab-manager-command'), this.getRequestOptions())
    ).catch((err) => {
      this.logger.error('Error while getting the update lab manager command', err);
      throw new BadRequestException('Error while getting the update lab manager command');
    });
  }

  ////////////////// METHODS TO BUILD THE REQUEST //////////////////

  private constructRoute(route: string): string {
    const isLocal = this.configService.isLocal() && false;
    let url: string;
    if (isLocal) {
      url = 'http://host.docker.internal:3001';
    } else {
      const privateFile = this.fileService.readPrivateFile();
      url = privateFile.space.api_url;
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
