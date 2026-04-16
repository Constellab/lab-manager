import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { ApiHttpOption } from '../api/api.class';
import { ApiService } from '../api/api.service';
import { FileService } from '../file/file.service';
import { BrickVersionDTO } from './external-community.class';

@Injectable()
export class ExternalCommunityApiService {
  private static readonly BRICKS_BASE_ROUTE = 'lab/brick';

  private static readonly API_KEY_HEADER = 'Authorization';
  private static readonly API_KEY_PREFIX = 'api-key';

  constructor(
    private apiService: ApiService,
    private fileService: FileService
  ) {}

  public async getBrickLatestVersion(brickName: string): Promise<BrickVersionDTO> {
    return this.getBrickVersion(brickName, 'latest');
  }

  public getBrickVersion(brickName: string, brickVersion: string): Promise<BrickVersionDTO> {
    return lastValueFrom(
      this.apiService.get(
        this.constructRoute(
          `${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/${brickName}/${brickVersion}`
        ),
        this.getRequestOptions()
      )
    );
  }

  public getAllWithFilters(filters: any, page: number, size: number): Promise<any> {
    return lastValueFrom(
      this.apiService.post(
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/search`),
        {
          titleFilter: filters.titleFilter,
        },
        {
          params: {
            page: page,
            size: size,
          },
        }
      )
    );
  }

  public getByName(name: string): Promise<any> {
    return lastValueFrom(
      this.apiService.get(
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/${name}`),
        this.getRequestOptions()
      )
    );
  }

  public getVersionsList(name: string): Promise<string[]> {
    return lastValueFrom(
      this.apiService.get(
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/${name}/versions`),
        this.getRequestOptions()
      )
    );
  }

  private constructRoute(route: string): string {
    const privateFile = this.fileService.readPrivateFile();

    return `${privateFile.community.api_url}/${route}`;
  }

  // get the axios request config with the api key in the header
  private getRequestOptions(options: ApiHttpOption = {}): ApiHttpOption {
    const privateFile = this.fileService.readPrivateFile();

    return Object.assign(options, { headers: this.getHeader(privateFile.space.prod_api_key) });
  }

  // get the header with api key
  private getHeader(apiKey: string): any {
    const header: any = {};
    if (apiKey) {
      header[ExternalCommunityApiService.API_KEY_HEADER] = `${ExternalCommunityApiService.API_KEY_PREFIX} ${apiKey}`;
    }
    // add the lab manager version in the header
    return header;
  }
}
