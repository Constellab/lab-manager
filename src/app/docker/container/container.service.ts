import {Injectable} from '@nestjs/common';

@Injectable()
export class ContainerService {

  private static readonly GLAB = 'glab';
  private static readonly CODELAB = 'codelab';
  private static readonly FRONT = 'front';
  private static readonly DB_GWS_CORE_PROD = 'gws_core_prod_db';
  private static readonly DB_GWS_BIOTA_PROD = 'gws_biota_prod_db';
  private static readonly DB_GWS_CORE_DEV = 'gws_core_dev_db';
  private static readonly DB_GWS_BIOTA_DEV = 'gws_biota_dev_db';
  private static readonly DB_GWS_CORE_DEV_TEST = 'test_gws_dev_db';
  private static readonly REVERSE_PROXY = 'reverse_proxy';

  constructor() {
  }

  public getContainersNames(): string[] {
    return [ContainerService.GLAB, ContainerService.CODELAB, ContainerService.FRONT, ContainerService.DB_GWS_CORE_PROD,
      ContainerService.DB_GWS_BIOTA_PROD, ContainerService.DB_GWS_CORE_DEV, ContainerService.DB_GWS_BIOTA_DEV,
      ContainerService.DB_GWS_CORE_DEV_TEST, ContainerService.REVERSE_PROXY];
  }
}
