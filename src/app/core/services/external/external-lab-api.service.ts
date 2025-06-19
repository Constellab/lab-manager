import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { ApiService } from 'src/app/core/services/api/api.service';
import { LabGlobalActivity } from './external-lab.class';
import { ApiHttpOption } from 'src/app/core/services/api/api.class';
import { FileService } from 'src/app/core/services/file/file.service';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { ComposeServiceName } from 'src/app/docker/compose-yaml';
import { ContainerService } from 'src/app/docker/container/container.service';

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
    if (this.configService.isDesktop()) {
      // use local network in desktop mode
      url = `http://${ComposeServiceName.GLAB}:${ContainerService.GLAB_INTERNAL_PORT}`;
    } else if (this.configService.isLocal()) {
      url = 'http://host.docker.internal:3100';
    } else {
      url = `https://${ComposeServiceName.GLAB}.${this.configService.getVirtualHost()}`;
    }

    return `${url}/${ExternalLabApiService.BASE_API_ROUTE}/${route}`;
  }

  // get the axios request config with the api key in the header
  private getRequestOptions(options: ApiHttpOption): ApiHttpOption {
    const privateFile = this.fileService.readPrivateFile();

    return Object.assign(options, { headers: this.getHeader(privateFile.space.prod_api_key) });
  }

  // get the header with api key
  private getHeader(apiKey: string): any {
    const header: any = {};
    header[ExternalLabApiService.API_KEY_HEADER] = `${ExternalLabApiService.API_KEY_SCHEMA} ${apiKey}`;
    return header;
  }
}
