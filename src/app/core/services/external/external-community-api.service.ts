import { Injectable } from '@nestjs/common';
import { ApiService } from '../api/api.service';
import { lastValueFrom } from 'rxjs';
import { FileService } from '../file/file.service';
import { ApiHttpOption } from '../api/api.class';
import { BrickVersionDTO } from './external-community.class';

@Injectable()
export class ExternalCommunityApiService {
  private static readonly BRICKS_BASE_ROUTE = 'brick';

  private static readonly API_KEY_HEADER = 'X-Api-Key';

  constructor(
    private apiService: ApiService,
    private fileService: FileService
  ) {}

  public async getBrickLatestVersion(brickName: string): Promise<BrickVersionDTO> {
    // TODO TO IMPROVE WHEN ROUTE TO GET LATEST VERSION WILL BE IMPLEMENTED
    const brick = await this.getByName(brickName);
    const brickVersions = await this.getVersionsList(brick.id);
    const latestVersion = brickVersions[0];
    return this.getBrickVersion(brickName, latestVersion);
  }

  public getBrickVersion(brickName: string, brickVersion: string): Promise<BrickVersionDTO> {
    return lastValueFrom(
      this.apiService.get(
        this.constructRoute(
          `${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/space/name/${brickName}/${brickVersion}`
        ),
        this.getRequestOptions()
      )
    );
  }

  public getAllWithFilters(filters: any, page: number, size: number): Promise<any> {
    return lastValueFrom(
      this.apiService.post(
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/filters`),
        filters,
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
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/name/${name}`)
      )
    );
  }

  public getVersionsList(brickId: string): Promise<string[]> {
    return lastValueFrom(
      this.apiService.get(
        this.constructRoute(`${ExternalCommunityApiService.BRICKS_BASE_ROUTE}/versions-list/${brickId}`)
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

    return Object.assign(options, { headers: this.getHeader(privateFile.community.api_key) });
  }

  // get the header with api key
  private getHeader(apiKey: string): any {
    const header: any = {};
    if (apiKey) {
      header[ExternalCommunityApiService.API_KEY_HEADER] = `${apiKey}`;
    }
    // add the lab manager version in the header
    return header;
  }
}
