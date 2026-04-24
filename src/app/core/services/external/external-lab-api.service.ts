import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { ApiHttpOption } from 'src/app/core/services/api/api.class';
import { ApiService } from 'src/app/core/services/api/api.service';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { FileService } from 'src/app/core/services/file/file.service';
import { MainComposeServiceName, MainDockerCompose } from '../../../docker/compose/main-docker-compose.class';
import { LabGlobalActivity } from './external-lab.class';

/**
 * Class to call route of the lab using space api
 */
@Injectable()
export class ExternalLabApiService {
  private static readonly API_KEY_HEADER = 'Authorization';
  private static readonly API_KEY_SCHEMA = 'api-key';

  private static readonly BASE_API_ROUTE = 'space-api';

  constructor(
    private apiService: ApiService,
    private fileService: FileService,
    private configService: CoreConfigService
  ) {}

  public healthCheck(): Promise<boolean> {
    return lastValueFrom(
      this.apiService.get(this.constructRoute('health-check'), { timeout: 1000, logError: false })
    ).catch(() => false);
  }

  public getGlobalActivity(): Promise<LabGlobalActivity> {
    return lastValueFrom(
      this.apiService.get(this.constructRoute('lab/global-activity'), this.getRequestOptions({}))
    );
  }

  ////////////////// METHODS TO BUILD THE REQUEST //////////////////

  private constructRoute(route: string): string {
    let url: string;
    if (this.configService.isLocal()) {
      // use local network in desktop mode
      url = `http://${MainComposeServiceName.GLAB}:${MainDockerCompose.GLAB_INTERNAL_PORT}`;
    } else {
      url = `https://${MainComposeServiceName.GLAB}.${this.configService.getVirtualHost()}`;
    }

    return `${url}/${ExternalLabApiService.BASE_API_ROUTE}/${route}`;
  }

  // get the axios request config with the api key in the header
  private getRequestOptions(options: ApiHttpOption): ApiHttpOption {
    const privateFile = this.fileService.readPrivateFile();

    return Object.assign(options, { headers: this.getHeader(privateFile.space.prodApiKey) });
  }

  // get the header with api key
  private getHeader(apiKey: string): any {
    const header: any = {};
    header[ExternalLabApiService.API_KEY_HEADER] = `${ExternalLabApiService.API_KEY_SCHEMA} ${apiKey}`;
    return header;
  }
}
